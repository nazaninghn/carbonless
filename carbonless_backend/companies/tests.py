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
        self.assertEqual(len(res.data), 1)


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
        names = [f['name'] for f in res.data]
        self.assertIn('Facility A', names)
        self.assertNotIn('Facility B', names)

    def test_user2_cannot_see_company1_detail(self):
        client = APIClient()
        client.force_authenticate(user=self.user2)
        res = client.get('/api/companies/detail/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['legal_entity_name'], 'Company B')
