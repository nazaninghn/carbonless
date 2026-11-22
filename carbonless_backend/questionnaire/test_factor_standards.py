"""An inventory is calculated on the factor standard it chose in D1.

* no standard (or a database name from before the standards) -> the platform catalogue, numbers unchanged;
* DEFRA -> the DEFRA edition of the inventory year (latest earlier edition when that year has none);
* a source the standard does not publish -> not calculated, except grid electricity (national factor);
* mix -> each question on the standard chosen for it, nothing calculated while it is not chosen.
"""
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management import call_command

from companies.models import Company, CompanyMembership
from emissions.factor_lookup import pick_factor, use_standard
from emissions.models import EmissionEntry, EmissionFactor
from questionnaire import tests as _base
from questionnaire.models import CarbonReport, ReportStep
from questionnaire.step_entries import inventory_standard, sync_step_entries
from questionnaire.test_calc_baseline import make_factors, post_scenario


def defra(slug, year, value, unit='m3', category='x', scope='scope1'):
    EmissionFactor.objects.update_or_create(
        slug=slug, country='global', year=year, standard='defra',
        defaults=dict(name=slug, scope=scope, category=category, unit=unit, factor_kg_co2e=value,
                      source='defra', is_active=True, is_default=False))


class PickFactorStandardTests(_base.TestCase):
    def setUp(self):
        make_factors()
        defra('natural-gas-m3', 2020, Decimal('2.02266'))
        defra('natural-gas-m3', 2026, Decimal('2.02633'))

    def test_catalogue_is_unchanged_by_a_standards_rows(self):
        self.assertEqual(pick_factor('natural-gas-m3', 'global', 2025).factor_kg_co2e, Decimal('2.02'))
        self.assertEqual(pick_factor('natural-gas-m3', 'global').standard, '')

    def test_standard_uses_the_edition_of_the_year(self):
        with use_standard('defra'):
            self.assertEqual(pick_factor('natural-gas-m3', 'global', 2020).factor_kg_co2e, Decimal('2.02266'))
            self.assertEqual(pick_factor('natural-gas-m3', 'global', 2024).factor_kg_co2e, Decimal('2.02266'))
            self.assertEqual(pick_factor('natural-gas-m3', 'global', 2026).factor_kg_co2e, Decimal('2.02633'))
            self.assertEqual(pick_factor('natural-gas-m3', 'global', 2030).factor_kg_co2e, Decimal('2.02633'))
            self.assertEqual(pick_factor('natural-gas-m3', 'global', 2015).factor_kg_co2e, Decimal('2.02266'))
        self.assertEqual(pick_factor('natural-gas-m3', 'global', 2026).factor_kg_co2e, Decimal('2.02'))

    def test_source_the_standard_does_not_publish_has_no_factor(self):
        with use_standard('defra'):
            self.assertIsNone(pick_factor('diesel', 'global', 2025))        # catalogue only
        with use_standard('ipcc'):
            self.assertIsNone(pick_factor('natural-gas-m3', 'global', 2025))  # DEFRA rows are not IPCC's

    def test_grid_electricity_keeps_the_national_factor(self):
        EmissionFactor.objects.update_or_create(
            slug='some-grid', country='turkey', year=2023, standard='',
            defaults=dict(name='grid', scope='scope2', category='electricity', unit='kwh',
                          factor_kg_co2e=Decimal('0.469'), source='turkey_grid', is_active=True, is_default=True))
        with use_standard('defra'):
            self.assertEqual(pick_factor('some-grid', 'turkey', 2025).factor_kg_co2e, Decimal('0.469'))


class InventoryStandardTests(_base.TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        self.user = User.objects.create_user('fs', 'fs@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Std Co', tax_number='8', country_of_headquarters='TR',
            countries_of_operation='TR', nace_code='', main_activity_description='x',
            number_of_employees='1-10', annual_turnover_range='x', number_of_facilities=1)
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.report = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        make_factors()
        defra('natural-gas-m3', 2024, Decimal('2.04542'))
        defra('natural-gas-m3', 2025, Decimal('2.06672'))

    def choose(self, value):
        ReportStep.objects.update_or_create(report=self.report, step_id='D1', defaults={'answer': {'ef_database': value}})

    def gas_kg(self):
        return [e.calculated_co2e_kg for e in EmissionEntry.objects.filter(
            inventory=self.report, emission_factor__slug='natural-gas-m3')]

    def test_choice_values(self):
        self.assertEqual(inventory_standard({'D1': {'ef_database': 'std_defra'}}), 'defra')
        self.assertEqual(inventory_standard({'D1': {'answer': 'std_mix'}}), 'mix')
        for legacy in ('DEFRA', 'DEFRA_TUIK', 'IPCC_AR6', 'EPA', 'custom', ''):
            self.assertEqual(inventory_standard({'D1': {'ef_database': legacy}}), '')
        self.assertEqual(inventory_standard({}), '')

    def test_d1_step_accepts_the_standards(self):
        for value in ('std_ghg', 'std_ipcc', 'std_defra', 'std_mix'):
            r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                                  {'step': 'D1', 'data': {'ef_database': value}}, format='json')
            self.assertEqual(r.status_code, 200, r.content)
        self.report.refresh_from_db()
        self.assertEqual(self.report.ef_database, 'std_mix')

    def test_no_standard_keeps_the_regression_number(self):
        self.choose('DEFRA_TUIK')
        post_scenario(self.client, self.report)
        self.assertEqual(self.gas_kg(), [Decimal('20200.0000')])

    def test_defra_inventory_uses_the_edition_of_its_year(self):
        self.choose('std_defra')
        post_scenario(self.client, self.report)
        self.assertEqual(self.gas_kg(), [Decimal('20667.2000')])            # 10 000 m3 x DEFRA 2025
        entry = EmissionEntry.objects.get(inventory=self.report, emission_factor__slug='natural-gas-m3')
        self.assertEqual(entry.emission_factor.standard, 'defra')
        self.assertEqual(entry.emission_factor.year, 2025)
        # Diesel has no DEFRA row here: not calculated, never the catalogue's 3.0.
        self.assertFalse(EmissionEntry.objects.filter(inventory=self.report, emission_factor__slug='diesel').exists())
        # Grid electricity keeps the national factor: 50 000 kWh x 0.4199.
        kwh = EmissionEntry.objects.filter(inventory=self.report, emission_factor__category='electricity')
        self.assertEqual([e.calculated_co2e_kg for e in kwh], [Decimal('20995.0000')])

    def test_changing_the_standard_recalculates(self):
        post_scenario(self.client, self.report)
        self.assertEqual(self.gas_kg(), [Decimal('20200.0000')])
        self.choose('std_defra')
        sync_step_entries(self.user, self.company, self.report, 'D1')
        self.assertEqual(self.gas_kg(), [Decimal('20667.2000')])

    def test_mix_calculates_a_question_on_its_own_standard(self):
        self.choose('std_mix')
        post_scenario(self.client, self.report)
        self.assertEqual(self.gas_kg(), [])                                  # standard of 3A-5 not chosen yet
        step = ReportStep.objects.get(report=self.report, step_id='3A-5')
        step.answer = {**step.answer, 'factor_standard': 'defra'}
        step.save()
        sync_step_entries(self.user, self.company, self.report, '3A-5')
        self.assertEqual(self.gas_kg(), [Decimal('20667.2000')])


class SeedDefraFactorsTests(_base.TestCase):
    def test_seed_loads_every_edition_and_is_idempotent(self):
        call_command('seed_defra_factors', verbosity=0)
        n = EmissionFactor.objects.filter(standard='defra').count()
        self.assertGreater(n, 1500)
        call_command('seed_defra_factors', verbosity=0)
        self.assertEqual(EmissionFactor.objects.filter(standard='defra').count(), n)
        gas = EmissionFactor.objects.get(slug='natural-gas-m3', standard='defra', year=2026)
        self.assertEqual(gas.factor_kg_co2e, Decimal('2.026330'))
        self.assertEqual(gas.gas_split_basis, 'published')
        self.assertEqual(sum(gas.gas_split().values()), gas.factor_kg_co2e)
        self.assertFalse(EmissionFactor.objects.filter(standard='defra', is_default=True).exists())
        for f in EmissionFactor.objects.filter(standard='defra').exclude(gas_split_basis=''):
            f.clean()                                                        # every published split adds up
