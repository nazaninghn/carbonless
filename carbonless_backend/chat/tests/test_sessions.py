from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from ..models import ChatSession, ChatMessage


class ChatSessionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('chatuser', 'chat@test.com', 'testpass123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_session(self):
        res = self.client.post('/api/chat/sessions/new/', {'title': 'Test Chat'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['title'], 'Test Chat')
        self.assertTrue(ChatSession.objects.filter(user=self.user).exists())

    def test_list_sessions(self):
        ChatSession.objects.create(user=self.user, title='Chat 1')
        ChatSession.objects.create(user=self.user, title='Chat 2')
        res = self.client.get('/api/chat/sessions/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 2)

    def test_get_session(self):
        session = ChatSession.objects.create(user=self.user, title='My Chat')
        ChatMessage.objects.create(session=session, role='user', content='Hello')
        ChatMessage.objects.create(session=session, role='assistant', content='Hi!')
        res = self.client.get(f'/api/chat/sessions/{session.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['messages']), 2)

    def test_delete_session(self):
        session = ChatSession.objects.create(user=self.user, title='Delete Me')
        res = self.client.delete(f'/api/chat/sessions/{session.id}/')
        # Fix #85 changed the DELETE response to 204 No Content (RFC 9110 §9.3.5).
        self.assertEqual(res.status_code, 204)
        self.assertFalse(ChatSession.objects.filter(id=session.id).exists())

    def test_session_isolation(self):
        """Other users cannot access sessions"""
        other = User.objects.create_user('other', 'other@test.com', 'testpass123')
        session = ChatSession.objects.create(user=other, title='Private')
        res = self.client.get(f'/api/chat/sessions/{session.id}/')
        self.assertEqual(res.status_code, 404)


class CompanyChatTests(TestCase):
    """A member of several companies sees each company's chats only while
    working in it."""

    def setUp(self):
        from companies.models import Company, CompanyMembership
        from accounts.models import UserProfile
        def company(name, tax):
            return Company.objects.create(
                legal_entity_name=name, tax_number=tax, country_of_headquarters='TR',
                countries_of_operation='TR', main_activity_description='x', number_of_employees='1-10',
                annual_turnover_range='x', number_of_facilities=1)
        self.a, self.b = company('A A.Ş.', '1'), company('B A.Ş.', '2')
        self.user = User.objects.create_user('multi', 'multi@test.com', 'testpass123')
        CompanyMembership.objects.create(company=self.a, user=self.user, role='owner')
        CompanyMembership.objects.create(company=self.b, user=self.user, role='data_entry')
        self.profile = UserProfile.objects.create(user=self.user, active_company=self.a)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_chats_follow_the_company(self):
        res = self.client.post('/api/chat/sessions/new/', {'title': 'A chat'}, format='json')
        a_chat = res.data['id']
        self.assertEqual(ChatSession.objects.get(id=a_chat).company, self.a)
        self.client.post('/api/companies/switch/', {'company_id': self.b.id}, format='json')
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.active_company, self.b)
        self.assertEqual(self.client.get('/api/chat/sessions/').data, [])
        self.assertEqual(self.client.get(f'/api/chat/sessions/{a_chat}/').status_code, 404)
        self.client.post('/api/companies/switch/', {'company_id': self.a.id}, format='json')
        self.assertEqual([s['id'] for s in self.client.get('/api/chat/sessions/').data], [a_chat])


class MultiItemMessageTests(TestCase):
    """The chat turns every item of a message into a pending entry and says what it couldn't read."""

    @classmethod
    def setUpTestData(cls):
        from django.core.management import call_command
        from io import StringIO
        call_command('seed_factors', stdout=StringIO())

    def setUp(self):
        from companies.models import Company, CompanyMembership
        from accounts.models import UserProfile
        self.user = User.objects.create_user('multi', 'multi@test.com', 'testpass123')
        company = Company.objects.create(
            legal_entity_name='Kaya Tekstil A.Ş.', tax_number='1234567890',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1,
        )
        UserProfile.objects.create(user=self.user, active_company=company)
        CompanyMembership.objects.create(company=company, user=self.user, role='owner')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.session = ChatSession.objects.create(user=self.user, title='t')

    def _send(self, text):
        return self.client.post(f'/api/chat/sessions/{self.session.id}/message/',
                                {'content': text, 'language': 'tr'}, format='json')

    def test_both_items_become_pending_entries(self):
        res = self._send("Ocak'ta 5.000 kWh elektrik ve 300 m3 doğalgaz kullandık")
        self.assertEqual(res.status_code, 200)
        kinds = [(p['fuel_type'], p['month']) for p in res.data['pending_entries']]
        self.assertEqual(kinds, [('electricity', 1), ('natural_gas', 1)])
        self.assertNotIn('anlayamadım', res.data['content'])

    def test_unreadable_part_is_named_in_the_reply(self):
        res = self._send('3 ton çelik ve 500 kWh elektrik')
        self.assertEqual(len(res.data['pending_entries']), 1)
        self.assertIn('"3 ton"', res.data['content'])


class LocalDataAnswerTests(TestCase):
    """Without the AI, simple questions about the company's data are answered
    from the database, and the chat speaks the UI language."""

    def setUp(self):
        from unittest import mock
        from companies.models import Company, CompanyMembership
        from accounts.models import UserProfile
        from emissions.models import EmissionFactor, EmissionEntry
        self.user = User.objects.create_user('localq', 'localq@test.com', 'testpass123')
        company = Company.objects.create(
            legal_entity_name='Yerel A.Ş.', tax_number='1234567891',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1,
        )
        UserProfile.objects.create(user=self.user, active_company=company)
        CompanyMembership.objects.create(company=company, user=self.user, role='owner')
        gas = EmissionFactor.objects.create(slug='lq-gas', name='Gas', name_tr='Doğal Gaz', scope='scope1',
                                            category='stationary_combustion', country='turkey', unit='m3',
                                            factor_kg_co2e=2, source='test')
        grid = EmissionFactor.objects.create(slug='lq-grid', name='Grid', name_tr='Şebeke', scope='scope2',
                                             category='electricity', country='turkey', unit='kwh',
                                             factor_kg_co2e=0.5, source='test')
        for f, qty, status in ((gas, 1000, 'approved'), (grid, 1000, 'approved'), (grid, 9000, 'draft')):
            EmissionEntry.objects.create(company=company, user=self.user, emission_factor=f, year=2020, month=1,
                                         quantity=qty, calculated_co2e_kg=qty * float(f.factor_kg_co2e), status=status)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.session = ChatSession.objects.create(user=self.user, title='t')
        patcher = mock.patch('chat.views._get_groq_client', return_value=None)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _send(self, text, lang='tr'):
        return self.client.post(f'/api/chat/sessions/{self.session.id}/message/',
                                {'content': text, 'language': lang}, format='json')

    def test_total_for_a_year(self):
        res = self._send('2020 yılı toplam emisyonumuz ne kadar?')
        self.assertEqual(res.status_code, 200)
        # 2 t gas + 0.5 t grid; the rejected 4.5 t is not counted.
        self.assertIn('**2,50 tCO₂e**', res.data['content'])
        self.assertIn('Kapsam 1: 2,00 t', res.data['content'])

    def test_largest_source(self):
        res = self._send('2020 yılında en çok emisyon hangi kaynaktan geliyor?')
        self.assertIn('**Doğal Gaz**', res.data['content'])
        # with the year's total and the next sources, not only the first one
        self.assertIn('toplam emisyonunuz **2,50 tCO₂e**', res.data['content'])
        self.assertIn('2. **', res.data['content'])

    def test_other_questions_get_a_turkish_unavailable_message(self):
        res = self._send('Emisyonlarımızı nasıl azaltabiliriz?')
        self.assertEqual(res.status_code, 503)
        self.assertIn('AI hizmetine şu an ulaşılamıyor', res.data['content'])
