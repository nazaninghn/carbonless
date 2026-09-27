from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from .models import Company, Facility, CompanyMembership


class CompanyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('cuser', 'c@test.com', 'testpass123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_company(self):
        res = self.client.post('/api/companies/create/', {
            'legal_entity_name': 'Test Corp',
            'tax_number': '1234567890',
            'country_of_headquarters': 'Turkey',
            'countries_of_operation': 'Turkey',
            'main_activity_description': 'Manufacturing',
            'number_of_employees': '51-250',
            'annual_turnover_range': '1M-10M',
            'number_of_facilities': 1,
        }, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertTrue(CompanyMembership.objects.filter(user=self.user, role='owner').exists())

    def test_get_company(self):
        company = Company.objects.create(
            legal_entity_name='Test Corp',
            tax_number='123', country_of_headquarters='TR',
            countries_of_operation='TR', main_activity_description='Test',
            number_of_employees='1-10', annual_turnover_range='<1M',
            number_of_facilities=1,
        )
        CompanyMembership.objects.create(company=company, user=self.user, role='owner')
        res = self.client.get('/api/companies/detail/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['legal_entity_name'], 'Test Corp')


class FacilityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('fuser', 'f@test.com', 'testpass123')
        self.company = Company.objects.create(
            legal_entity_name='Fac Corp',
            tax_number='999', country_of_headquarters='TR',
            countries_of_operation='TR', main_activity_description='Test',
            number_of_employees='1-10', annual_turnover_range='<1M',
            number_of_facilities=2,
        )
        CompanyMembership.objects.create(company=self.company, user=self.user, role='owner')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_facility(self):
        res = self.client.post('/api/companies/facilities/', {
            'name': 'Main Office', 'city': 'Istanbul',
            'country': 'Turkey', 'facility_type': 'Office',
            'company': self.company.pk,
        }, format='json')
        self.assertEqual(res.status_code, 201)

    def test_list_facilities(self):
        Facility.objects.create(company=self.company, name='HQ', city='Istanbul')
        res = self.client.get('/api/companies/facilities/')
        self.assertEqual(res.status_code, 200)
        data = res.data.get('results', res.data) if isinstance(res.data, dict) else res.data
        self.assertEqual(len(data), 1)


class CompanyIsolationTests(TestCase):
    """Test that users cannot access other companies' data"""

    def setUp(self):
        self.user1 = User.objects.create_user('user1', 'u1@test.com', 'pass12345')
        self.user2 = User.objects.create_user('user2', 'u2@test.com', 'pass12345')

        self.company1 = Company.objects.create(
            legal_entity_name='Company A', tax_number='111',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='A', number_of_employees='1-10',
            annual_turnover_range='<1M', number_of_facilities=1,
        )
        self.company2 = Company.objects.create(
            legal_entity_name='Company B', tax_number='222',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='B', number_of_employees='1-10',
            annual_turnover_range='<1M', number_of_facilities=1,
        )

        CompanyMembership.objects.create(company=self.company1, user=self.user1, role='owner')
        CompanyMembership.objects.create(company=self.company2, user=self.user2, role='owner')

        Facility.objects.create(company=self.company1, name='Facility A')
        Facility.objects.create(company=self.company2, name='Facility B')

    def test_user1_cannot_see_company2_facilities(self):
        client = APIClient()
        client.force_authenticate(user=self.user1)
        res = client.get('/api/companies/facilities/')
        self.assertEqual(res.status_code, 200)
        data = res.data.get('results', res.data) if isinstance(res.data, dict) else res.data
        names = [f['name'] for f in data]
        self.assertIn('Facility A', names)
        self.assertNotIn('Facility B', names)

    def test_user2_cannot_see_company1_detail(self):
        client = APIClient()
        client.force_authenticate(user=self.user2)
        res = client.get('/api/companies/detail/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['legal_entity_name'], 'Company B')


class InviteFlowTests(TestCase):
    """An invite emails a join link, and a new signup with that address joins on verification."""

    def setUp(self):
        from accounts.models import UserProfile
        self.owner = User.objects.create_user('owner', 'owner@test.com', 'testpass123')
        UserProfile.objects.create(user=self.owner)
        self.company = Company.objects.create(
            legal_entity_name='Kaya Tekstil A.Ş.', tax_number='1234567890',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1,
        )
        CompanyMembership.objects.create(company=self.company, user=self.owner, role='owner')
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def _invite(self, email='ali@test.com'):
        res = self.client.post('/api/companies/invite/', {'email': email, 'role': 'data_entry'}, format='json')
        self.assertEqual(res.status_code, 200)
        return res.data

    def test_invite_sends_an_email_with_the_join_link(self):
        from django.core import mail
        data = self._invite()
        self.assertTrue(data['email_sent'])
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['ali@test.com'])
        self.assertIn(f"/accept-invite?token={data['token']}", mail.outbox[0].body)

    def test_new_signup_joins_the_team_when_the_email_is_verified(self):
        from accounts.models import EmailVerificationToken
        self._invite('ali@test.com')
        res = APIClient().post('/api/accounts/register/', {
            'username': 'ali', 'email': 'ali@test.com',
            'password': 'StrongPass123', 'password2': 'StrongPass123',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        ali = User.objects.get(username='ali')
        self.assertFalse(CompanyMembership.objects.filter(user=ali, company=self.company).exists())
        code = EmailVerificationToken.objects.get(user=ali).code
        res = APIClient().post('/api/accounts/verify-email-code/', {'email': 'ali@test.com', 'code': code}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['joined_companies'], ['Kaya Tekstil A.Ş.'])
        membership = CompanyMembership.objects.get(user=ali, company=self.company)
        self.assertEqual(membership.role, 'data_entry')
        ali.profile.refresh_from_db()
        self.assertEqual(ali.profile.active_company, self.company)

    def test_opening_the_link_after_auto_join_still_succeeds(self):
        data = self._invite('ali@test.com')
        ali = User.objects.create_user('ali', 'ali@test.com', 'testpass123')
        from companies.views import accept_pending_invites
        accept_pending_invites(ali)
        client = APIClient(); client.force_authenticate(user=ali)
        res = client.post('/api/companies/accept-invite/', {'token': data['token']}, format='json')
        self.assertEqual(res.status_code, 200)

    def test_used_invite_cannot_be_taken_by_someone_else(self):
        data = self._invite('ali@test.com')
        ali = User.objects.create_user('ali', 'ali@test.com', 'testpass123')
        from companies.views import accept_pending_invites
        accept_pending_invites(ali)
        other = User.objects.create_user('eve', 'eve@test.com', 'testpass123')
        client = APIClient(); client.force_authenticate(user=other)
        res = client.post('/api/companies/accept-invite/', {'token': data['token']}, format='json')
        self.assertEqual(res.status_code, 404)
        self.assertFalse(CompanyMembership.objects.filter(user=other, company=self.company).exists())
