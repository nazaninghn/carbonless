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
        # Tokens in both cookies and body (cross-origin support)
        self.assertIn('access_token', res.cookies)
        self.assertIn('access', res.data)

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


class RegistrationCompanyTests(TestCase):
    """The company details from the signup form are saved at signup.

    The account is inactive until its email is verified, so they cannot wait
    for a post-login call — that call never ran and the details were lost.
    """

    def _register(self, username, company=None):
        body = {
            'username': username, 'email': f'{username}@test.com',
            'password': 'StrongPass123', 'password2': 'StrongPass123',
        }
        if company is not None:
            body['company'] = company
        res = APIClient().post('/api/accounts/register/', body, format='json')
        self.assertEqual(res.status_code, 201)
        user = User.objects.get(username=username)
        return res.json(), user.company_memberships.get().company

    def test_signup_company_details_are_stored(self):
        data, company = self._register('kaya', {
            'legal_entity_name': 'Kaya Tekstil A.Ş.',
            'tax_number': '1234567890',
            'country_of_headquarters': 'TR',
            'countries_of_operation': 'TR',
            'nace_code': 'C13',
            'main_activity_description': 'Kumaş üretimi',
            'number_of_employees': '51-250',
            'annual_turnover_range': '10M-50M',
            'number_of_facilities': 2,
            'has_iso_14001': True,
        })
        self.assertTrue(data['company_saved'])
        self.assertEqual(company.legal_entity_name, 'Kaya Tekstil A.Ş.')
        self.assertEqual(company.tax_number, '1234567890')
        self.assertEqual(company.nace_code, 'C13')
        self.assertTrue(company.has_iso_14001)

    def test_optional_blank_fields_fall_back_to_placeholders(self):
        # Tax number is optional on the form; a blank one must not reject the rest.
        data, company = self._register('blanktax', {
            'legal_entity_name': 'Blank Tax Ltd', 'tax_number': '',
        })
        self.assertTrue(data['company_saved'])
        self.assertEqual(company.legal_entity_name, 'Blank Tax Ltd')
        self.assertEqual(company.tax_number, '—')

    def test_without_company_details_a_placeholder_is_created(self):
        data, company = self._register('nocompany')
        self.assertFalse(data['company_saved'])
        self.assertEqual(company.legal_entity_name, "nocompany's Company")


class AuthErrorCodeTests(TestCase):
    """Auth errors carry a code so the UI can show them in Turkish."""

    def test_wrong_verification_code_reports_attempts_left(self):
        from .models import EmailVerificationToken
        user = User.objects.create_user('kod', 'kod@test.com', 'testpass123')
        token = EmailVerificationToken.objects.create(user=user)
        wrong = '000000' if token.code != '000000' else '111111'
        res = APIClient().post('/api/accounts/verify-email-code/', {'email': 'kod@test.com', 'code': wrong}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['code'], 'wrong_code')
        self.assertEqual(res.data['attempts_remaining'], token.MAX_ATTEMPTS - 1)

    def test_used_reset_link_has_a_code(self):
        from .models import PasswordResetToken
        user = User.objects.create_user('rst', 'rst@test.com', 'testpass123')
        token = PasswordResetToken.objects.create(user=user)
        client = APIClient()
        body = {'token': str(token.token), 'new_password': 'Yeni-Sifre-2026!'}
        self.assertEqual(client.post('/api/accounts/password-reset-confirm/', body, format='json').status_code, 200)
        res = client.post('/api/accounts/password-reset-confirm/', body, format='json')
        self.assertEqual(res.data['code'], 'link_used')
