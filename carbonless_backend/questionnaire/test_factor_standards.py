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


class _InventoryCase(_base.TestCase):
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


class InventoryStandardTests(_InventoryCase):
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
        post_scenario(self.client, self.report)                              # answered before "mix" was chosen
        self.choose('std_mix')
        sync_step_entries(self.user, self.company, self.report, 'D1')
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


class MixQuestionStandardTests(_InventoryCase):
    """The standard of a "mix" inventory's question travels with its answer."""

    def save(self, answer, **extra):
        return self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                                 {'step': '3A-5', 'data': {'answer': answer, **extra}, 'language': 'tr'}, format='json')

    def test_mix_refuses_a_calculating_answer_without_its_standard(self):
        self.choose('std_mix')
        r = self.save({'natural_gas': '10000 m³'})
        self.assertEqual(r.status_code, 400, r.content)
        self.assertEqual(r.data['code'], 'factor_standard')
        self.assertIn('standardını', r.data['error'])                         # Turkish, as asked
        self.assertFalse(ReportStep.objects.filter(report=self.report, step_id='3A-5').exists())

    def test_mix_saves_and_calculates_with_the_chosen_standard(self):
        self.choose('std_mix')
        r = self.save({'natural_gas': '10000 m³'}, factor_standard='defra')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(ReportStep.objects.get(report=self.report, step_id='3A-5').answer['factor_standard'], 'defra')
        self.assertEqual(self.gas_kg(), [Decimal('20667.2000')])
        # A later save of the same question that does not repeat the standard keeps it.
        r = self.save({'natural_gas': '5000 m³'})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self.gas_kg(), [Decimal('10333.6000')])

    def test_an_unknown_standard_is_refused_in_any_inventory(self):
        r = self.save({'natural_gas': '10000 m³'}, factor_standard='epa')
        self.assertEqual(r.status_code, 400, r.content)
        self.assertEqual(r.data['code'], 'factor_standard')

    def test_a_single_standard_inventory_needs_no_choice_per_question(self):
        self.choose('std_defra')
        self.assertEqual(self.save({'natural_gas': '10000 m³'}).status_code, 200)
        self.assertEqual(self.gas_kg(), [Decimal('20667.2000')])

    def test_frontend_step_list_is_the_servers(self):
        import re
        from pathlib import Path
        from questionnaire.step_entries import ENTRY_STEPS
        src = (Path(__file__).resolve().parents[2] / 'nexus_insights-saas-neon_nextjs' / 'src' / 'lib'
               / 'carboniq' / 'factorStandard.js').read_text(encoding='utf-8')
        block = src[src.index('FACTOR_STANDARD_STEPS = new Set(['):src.index(']);')]
        self.assertEqual(sorted(re.findall(r"'([^']+)'", block)), sorted(ENTRY_STEPS))


class StandardIsAskedFirstTests(_InventoryCase):
    def test_a_new_inventory_starts_at_the_standard(self):
        self.assertEqual(CarbonReport._meta.get_field('current_step').default, 'D1')
        from questionnaire.step_handlers import STEP_FLOW, STRICT_STEP_ORDER
        self.assertEqual(STRICT_STEP_ORDER[:2], ['D1', 'A1'])
        self.assertEqual((STEP_FLOW['D1'], STEP_FLOW['C3']), ('A1', 'D3'))

    def test_answering_the_standard_leads_to_the_company_name(self):
        r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                              {'step': 'D1', 'data': {'ef_database': 'std_defra'}}, format='json')
        self.assertEqual((r.status_code, r.data['next_step']), (200, 'A1'))

    def test_a_country_suggestion_never_replaces_the_chosen_standard(self):
        from questionnaire.step_handlers import handle_A3
        self.report.ef_database = 'std_ipcc'
        self.report.save()
        handle_A3(self.report, {'country': 'TR', 'city': 'Istanbul'})
        self.report.refresh_from_db()
        self.assertEqual(self.report.ef_database, 'std_ipcc')

    def test_the_copied_company_profile_leaves_the_standard_out(self):
        from questionnaire.views import PHASE1_REPORT_FIELDS, PHASE1_STEP_IDS
        self.assertNotIn('D1', PHASE1_STEP_IDS)
        self.assertNotIn('ef_database', PHASE1_REPORT_FIELDS)
