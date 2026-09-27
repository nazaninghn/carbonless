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
