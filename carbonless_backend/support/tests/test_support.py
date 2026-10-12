from unittest import mock

from django.contrib.auth.models import User
from django.core import mail
from django.test import TestCase, RequestFactory
from rest_framework.test import APIClient

from chat.models import ChatMessage, ChatSession
from support.models import AnswerFeedback, SupportRequest
from support.service import support_topic


class SupportTopicTests(TestCase):
    """Only questions a person has to look at go to the team."""

    def test_needs_the_team(self):
        for text, topic in [
            ('Giriş yapamıyorum, şifremi unuttum', 'account'),
            ('Aboneliğimi iptal etmek istiyorum', 'billing'),
            ('Rapor sayfası açılmıyor, hata veriyor', 'bug'),
            ('Geçen ayın verilerim kayboldu', 'data'),
            ('SAP ile entegrasyon yapabilir miyiz?', 'integration'),
            ('KVKK kapsamında verilerimiz nerede tutuluyor?', 'legal'),
            ('Bir uzman ile görüşmek istiyorum', 'other'),
            ("I can't log in", 'account'),
        ]:
            self.assertEqual(support_topic(text), topic, text)

    def test_the_ai_handles_the_rest(self):
        for text in ['Kapsam 2 nedir?', '500 kWh elektrik', 'Ocak ayında 1200 m3 doğalgaz faturası ödedik',
                     'İade edilen ürünler hangi kategoride?', 'Emisyonlarımızı nasıl azaltabiliriz?']:
            self.assertIsNone(support_topic(text), text)


class SupportFlowTests(TestCase):
    def setUp(self):
        from accounts.models import UserProfile
        from companies.models import Company, CompanyMembership
        self.company = Company.objects.create(
            legal_entity_name='Destek A.Ş.', tax_number='1234567890', country_of_headquarters='TR',
            countries_of_operation='TR', main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1)
        self.user = User.objects.create_user('kul', 'kul@test.com', 'testpass123')
        UserProfile.objects.create(user=self.user, active_company=self.company)
        CompanyMembership.objects.create(company=self.company, user=self.user, role='owner')
        self.staff = User.objects.create_user('ops', 'ops@test.com', 'x', is_staff=True, is_superuser=True)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.session = ChatSession.objects.create(user=self.user, title='t')
        patcher = mock.patch('chat.views._get_groq_client', return_value=None)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _send(self, text, lang='tr'):
        return self.client.post(f'/api/chat/sessions/{self.session.id}/message/',
                                {'content': text, 'language': lang}, format='json')

    def test_chat_refers_and_alerts_the_team(self):
        res = self._send('Rapor sayfası açılmıyor, hata veriyor')
        self.assertEqual(res.status_code, 200)
        req = SupportRequest.objects.get()
        self.assertEqual((req.source, req.topic, req.status, req.company), ('ai', 'bug', 'open', self.company))
        self.assertIn(f'talep #{req.pk}', res.data['content'])
        self.assertEqual(res.data['support_request']['id'], req.pk)
        self.assertIn('Rapor sayfası açılmıyor', req.context)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('ops@test.com', mail.outbox[0].to)
        self.assertIn(f'/admin/support/supportrequest/{req.pk}/change/', mail.outbox[0].body)

    def test_ai_token_refers(self):
        with mock.patch('chat.views._get_groq_client', return_value=object()), \
             mock.patch('chat.views._call_groq',
                        return_value=('Bunu destek ekibimizin incelemesi gerekiyor. [[DESTEK]]', None, 200)):
            res = self._send('Doğrulama kuruluşu raporumuzu kabul eder mi, bizim tesis için?')
        self.assertEqual(res.status_code, 200)
        self.assertNotIn('[[DESTEK]]', res.data['content'])
        self.assertIn('Bunu destek ekibimizin incelemesi gerekiyor.', res.data['content'])
        self.assertEqual(SupportRequest.objects.get().source, 'ai')

    def test_admin_answer_reaches_the_user(self):
        from accounts.models import Notification
        from support.admin import SupportRequestAdmin
        from django.contrib.admin.sites import site
        self._send('Aboneliğimi iptal etmek istiyorum')
        req = SupportRequest.objects.get()
        admin_obj = SupportRequestAdmin(SupportRequest, site)
        request = RequestFactory().post('/')
        request.user = self.staff
        admin_obj.message_user = lambda *a, **k: None
        form = mock.Mock(changed_data=['answer'])
        req.answer = 'Ayarlar → Abonelik bölümünden iptal edebilirsiniz.'
        admin_obj.save_model(request, req, form, True)
        req.refresh_from_db()
        self.assertEqual((req.status, req.answered_by), ('answered', self.staff))
        n = Notification.objects.get(user=self.user)
        self.assertIn(f'#{req.pk}', n.title)
        self.assertIn('Abonelik', n.message)
        self.assertEqual(n.link, f'/dashboard?tab=ai_carbon&chat={self.session.id}')
        last = self.session.messages.order_by('-created_at').first()
        self.assertEqual(last.ui, {'support_request_id': req.pk})
        self.assertIn('Ayarlar → Abonelik', last.content)
        self.assertTrue(any('kul@test.com' in m.to for m in mail.outbox))

    def test_user_asks_support_from_the_chat(self):
        res = self.client.post('/api/support/requests/', {
            'question': 'Kapsam 3 kategori 1 için hangi yöntemi seçmeliyiz?', 'session_id': self.session.id,
            'language': 'tr'}, format='json')
        self.assertEqual(res.status_code, 201)
        req = SupportRequest.objects.get()
        self.assertEqual(req.source, 'user')
        msg = ChatMessage.objects.get(pk=res.data['message_id'])
        self.assertEqual(msg.ui, {'support_request_id': req.pk, 'referred': True})
        mine = self.client.get('/api/support/requests/')
        self.assertEqual([r['id'] for r in mine.data], [req.pk])
        self.assertEqual(self.client.post('/api/support/requests/', {'question': ''}, format='json').status_code, 400)

    def test_feedback_on_an_answer(self):
        self.session.messages.create(role='user', content='Kapsam 2 nedir?')
        answer = self.session.messages.create(role='assistant', content='Satın alınan enerji…')
        res = self.client.post('/api/support/feedback/', {'message_id': answer.id, 'helpful': False,
                                                          'comment': 'Örnek yok'}, format='json')
        self.assertEqual(res.status_code, 200)
        fb = AnswerFeedback.objects.get()
        self.assertEqual((fb.helpful, fb.comment, fb.question), (False, 'Örnek yok', 'Kapsam 2 nedir?'))
        self.client.post('/api/support/feedback/', {'message_id': answer.id, 'helpful': True}, format='json')
        self.assertEqual(AnswerFeedback.objects.get().helpful, True)
        # Someone else's message is not found; the feedback outlives the chat.
        other = User.objects.create_user('o', 'o@test.com', 'x')
        c = APIClient()
        c.force_authenticate(user=other)
        self.assertEqual(c.post('/api/support/feedback/', {'message_id': answer.id, 'helpful': True},
                                format='json').status_code, 404)
        self.session.delete()
        self.assertEqual(AnswerFeedback.objects.count(), 1)
