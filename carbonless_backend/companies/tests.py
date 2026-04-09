from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from .models import Company, Facility


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
        self.assertTrue(Company.objects.filter(user=self.user).exists())

    def test_get_company(self):
        Company.objects.create(
            user=self.user, legal_entity_name='Test Corp',
            tax_number='123', country_of_headquarters='TR',
            countries_of_operation='TR', main_activity_description='Test',
            number_of_employees='1-10', annual_turnover_range='<1M',
            number_of_facilities=1,
        )
        res = self.client.get('/api/companies/detail/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['legal_entity_name'], 'Test Corp')


class FacilityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('fuser', 'f@test.com', 'testpass123')
        self.company = Company.objects.create(
            user=self.user, legal_entity_name='Fac Corp',
            tax_number='999', country_of_headquarters='TR',
            countries_of_operation='TR', main_activity_description='Test',
            number_of_employees='1-10', annual_turnover_range='<1M',
            number_of_facilities=2,
        )
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
