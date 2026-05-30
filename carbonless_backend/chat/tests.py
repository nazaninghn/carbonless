from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from .models import ChatSession, ChatMessage


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
