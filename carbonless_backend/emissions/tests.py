from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from .gas_split_data import fuel_gas_shares
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


class GasSplitTests(TestCase):
    """The per-gas breakdown ISO 14064-1 reporting needs."""

    def _factor(self, **kw):
        defaults = dict(
            slug='split-test', name='Split Test', scope='scope1',
            category='stationary_combustion', country='global', unit='kg',
            factor_kg_co2e=Decimal('100'), year=2024, source='generic',
        )
        defaults.update(kw)
        return EmissionFactor(**defaults)

    def test_no_split_reads_as_none(self):
        """A factor with no breakdown must not look like an all-zero one."""
        f = self._factor()
        self.assertIsNone(f.gas_split())
        self.assertIsNone(f.gas_split_shares())

    def test_shares_sum_to_one(self):
        f = self._factor(
            factor_co2_kg_co2e=Decimal('97'), factor_ch4_kg_co2e=Decimal('1'),
            factor_n2o_kg_co2e=Decimal('2'), gas_split_basis='apportioned')
        shares = f.gas_split_shares()
        self.assertEqual(sorted(shares), ['CH4', 'CO2', 'N2O'])
        self.assertAlmostEqual(float(sum(shares.values())), 1.0, places=9)
        self.assertAlmostEqual(float(shares['CO2']), 0.97, places=9)

    def test_gases_with_no_contribution_are_omitted(self):
        f = self._factor(factor_sf6_kg_co2e=Decimal('100'),
                         gas_split_basis='single_gas')
        self.assertEqual(f.gas_split(), {'SF6': Decimal('100')})

    def test_split_must_add_up_to_the_factor(self):
        f = self._factor(factor_co2_kg_co2e=Decimal('50'),
                         gas_split_basis='apportioned')
        with self.assertRaises(ValidationError) as ctx:
            f.clean()
        self.assertIn('factor_kg_co2e', ctx.exception.message_dict)

    def test_rounding_drift_is_tolerated(self):
        f = self._factor(factor_co2_kg_co2e=Decimal('99.995'),
                         gas_split_basis='apportioned')
        f.clean()  # within tolerance — must not raise

    def test_split_requires_a_stated_basis(self):
        """A breakdown with no provenance cannot go in an assurance document."""
        f = self._factor(factor_co2_kg_co2e=Decimal('100'))
        with self.assertRaises(ValidationError) as ctx:
            f.clean()
        self.assertIn('gas_split_basis', ctx.exception.message_dict)

    def test_seeded_combustion_factor_keeps_its_total(self):
        """Apportioning must divide a factor, never change it."""
        shares = fuel_gas_shares('diesel_onroad')
        self.assertAlmostEqual(sum(shares.values()), 1.0, places=9)
        # CO2 dominates, but CH4 and N2O are both present and non-zero.
        self.assertGreater(shares['CO2'], 0.9)
        self.assertGreater(shares['CH4'], 0)
        self.assertGreater(shares['N2O'], 0)


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
        from companies.models import Company, CompanyMembership
        self.company = Company.objects.create(
            legal_entity_name='Test Co', tax_number='123',
            country_of_headquarters='TR', countries_of_operation='TR',
            main_activity_description='Test', number_of_employees='1-10',
            annual_turnover_range='<1M', number_of_facilities=1,
        )
        CompanyMembership.objects.create(company=self.company, user=self.user, role='owner')
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
            user=self.user, company=self.company, emission_factor=self.factor,
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
