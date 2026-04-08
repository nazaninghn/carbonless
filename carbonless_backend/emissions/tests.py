from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from .models import EmissionFactor, EmissionEntry


class EmissionFactorTests(TestCase):
    def setUp(self):
        self.factor = EmissionFactor.objects.create(
            slug='test-gas', name='Test Gas', name_tr='Test Gaz',
            scope='scope1', category='stationary_combustion', country='global',
            unit='kg', factor_kg_co2e=2.5, year=2024, source='generic',
            is_active=True, is_default=True,
        )

    def test_factor_created(self):
        self.assertEqual(EmissionFactor.objects.count(), 1)
        self.assertEqual(self.factor.factor_kg_co2e, 2.5)

    def test_factor_str(self):
        self.assertIn('Test Gas', str(self.factor))


class EmissionEntryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('testuser', 'test@test.com', 'testpass123')
        self.factor = EmissionFactor.objects.create(
            slug='test-elec', name='Test Electricity', name_tr='Test Elektrik',
            scope='scope2', category='electricity', country='turkey',
            unit='kwh', factor_kg_co2e=0.4199, year=2023, source='atom_kablo',
            is_active=True, is_default=True,
        )

    def test_entry_auto_calculate(self):
        entry = EmissionEntry.objects.create(
            user=self.user, emission_factor=self.factor,
            year=2026, month=1, quantity=1000,
        )
        self.assertAlmostEqual(float(entry.calculated_co2e_kg), 419.9, places=1)

    def test_entry_tonne(self):
        entry = EmissionEntry.objects.create(
            user=self.user, emission_factor=self.factor,
            year=2026, month=1, quantity=1000,
        )
        self.assertAlmostEqual(float(entry.calculated_co2e_tonne), 0.4199, places=3)


class CalculatorTests(TestCase):
    def setUp(self):
        self.factor = EmissionFactor.objects.create(
            slug='test-diesel', name='Test Diesel', name_tr='Test Dizel',
            scope='scope1', category='mobile_combustion', country='turkey',
            unit='liters', factor_kg_co2e=2.696, year=2023, source='atom_kablo',
            is_active=True, is_default=True,
        )

    def test_calculate_by_id(self):
        from .calculator import calculate_emissions
        result = calculate_emissions(self.factor.pk, 100)
        self.assertAlmostEqual(result['emissions_kg'], 269.6, places=1)
        self.assertEqual(result['scope'], 'scope1')

    def test_calculate_negative(self):
        from .calculator import calculate_emissions
        result = calculate_emissions(self.factor.pk, -10)
        self.assertIn('error', result)

    def test_get_factor_lookup(self):
        from .calculator import get_emission_factor
        f = get_emission_factor('test-diesel', 'turkey', 'mobile_combustion')
        self.assertIsNotNone(f)
        self.assertEqual(float(f.factor_kg_co2e), 2.696)

    def test_get_factor_not_found(self):
        from .calculator import get_emission_factor
        f = get_emission_factor('nonexistent', 'turkey', 'electricity')
        self.assertIsNone(f)


class APITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('apiuser', 'api@test.com', 'testpass123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.factor = EmissionFactor.objects.create(
            slug='api-test', name='API Test Factor', name_tr='API Test',
            scope='scope2', category='electricity', country='turkey',
            unit='kwh', factor_kg_co2e=0.4199, year=2023, source='atom_kablo',
            is_active=True, is_default=True,
        )

    def test_list_factors(self):
        res = self.client.get('/api/emissions/factors/')
        self.assertEqual(res.status_code, 200)

    def test_create_entry(self):
        res = self.client.post('/api/emissions/entries/', {
            'emission_factor': self.factor.pk,
            'year': 2026, 'month': 1, 'quantity': 500,
        })
        self.assertEqual(res.status_code, 201)

    def test_summary(self):
        EmissionEntry.objects.create(
            user=self.user, emission_factor=self.factor,
            year=2026, month=1, quantity=1000,
        )
        res = self.client.get('/api/emissions/summary/?year=2026')
        self.assertEqual(res.status_code, 200)
        self.assertGreater(res.data['total_kg'], 0)

    def test_calculate_endpoint(self):
        res = self.client.post('/api/emissions/calculate/', {
            'factor_id': self.factor.pk, 'activity_data': 1000,
        })
        self.assertEqual(res.status_code, 200)
        self.assertAlmostEqual(res.data['emissions_kg'], 419.9, places=1)
