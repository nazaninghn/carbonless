from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from .models import QuestionnaireSession


class QuestionnaireTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('quser', 'q@test.com', 'testpass123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_start_session(self):
        res = self.client.post('/api/questionnaire/start/', {'lang': 'en'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn('session_id', res.data)
        self.assertIn('question', res.data)
        self.assertEqual(res.data['question']['id'], 'S1')

    def test_answer_question(self):
        start = self.client.post('/api/questionnaire/start/', {'lang': 'en'}, format='json')
        sid = start.data['session_id']
        res = self.client.post('/api/questionnaire/answer/', {
            'session_id': sid, 'question_id': 'S1',
            'answer': {'selected': 'C1.1', 'input_C1.1': '2024'}, 'lang': 'en'
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['is_complete'])

    def test_reset_session(self):
        self.client.post('/api/questionnaire/start/', {'lang': 'en'}, format='json')
        res = self.client.post('/api/questionnaire/reset/', format='json')
        self.assertEqual(res.status_code, 200)

    def test_profile_not_started(self):
        res = self.client.get('/api/questionnaire/profile/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'not_started')
