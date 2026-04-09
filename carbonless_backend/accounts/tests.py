from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient


class AuthTests(TestCase):
    def test_register(self):
        client = APIClient()
        res = client.post('/api/accounts/register/', {
            'username': 'newuser', 'email': 'new@test.com',
            'password': 'StrongPass123', 'password2': 'StrongPass123',
        })
        self.assertEqual(res.status_code, 201)
        self.assertTrue(User.objects.filter(username='newuser').exists())

    def test_register_password_mismatch(self):
        client = APIClient()
        res = client.post('/api/accounts/register/', {
            'username': 'newuser2', 'email': 'new2@test.com',
            'password': 'StrongPass123', 'password2': 'WrongPass',
        })
        self.assertEqual(res.status_code, 400)

    def test_login(self):
        User.objects.create_user('loginuser', 'login@test.com', 'TestPass123')
        client = APIClient()
        res = client.post('/api/accounts/login/', {
            'username': 'loginuser', 'password': 'TestPass123',
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'ok')
        # Tokens are in HttpOnly cookies, not in response body
        self.assertIn('access_token', res.cookies)

    def test_profile(self):
        user = User.objects.create_user('profuser', 'prof@test.com', 'TestPass123')
        client = APIClient()
        client.force_authenticate(user=user)
        res = client.get('/api/accounts/profile/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['username'], 'profuser')

    def test_change_password(self):
        user = User.objects.create_user('pwuser', 'pw@test.com', 'OldPass123')
        client = APIClient()
        client.force_authenticate(user=user)
        res = client.post('/api/accounts/change-password/', {
            'old_password': 'OldPass123', 'new_password': 'NewPass456',
        })
        self.assertEqual(res.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.check_password('NewPass456'))
