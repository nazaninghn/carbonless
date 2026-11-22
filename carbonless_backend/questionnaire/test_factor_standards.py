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


class IpccGhgFactorTests(_InventoryCase):
    """The IPCC and GHG Protocol standards: IPCC 2006 defaults on AR5 / AR6 GWPs."""

    def setUp(self):
        super().setUp()
        call_command('seed_ipcc_ghg_factors', verbosity=0)

    def test_seed_is_idempotent_and_every_split_adds_up(self):
        n = EmissionFactor.objects.filter(standard__in=('ipcc', 'ghg')).count()
        self.assertEqual(n, 72)
        call_command('seed_ipcc_ghg_factors', verbosity=0)
        self.assertEqual(EmissionFactor.objects.filter(standard__in=('ipcc', 'ghg')).count(), n)
        for f in EmissionFactor.objects.filter(standard__in=('ipcc', 'ghg')):
            f.clean()
            self.assertFalse(f.is_default)

    def test_values_are_the_published_defaults_on_each_gwp_set(self):
        def get(standard, slug):
            return EmissionFactor.objects.get(standard=standard, slug=slug)
        # Natural gas, per GJ: 56 100 kg CO2 + 1 kg CH4 + 0.1 kg N2O per TJ (IPCC 2006 Table 2.3).
        self.assertEqual(get('ipcc', 'natural-gas').factor_kg_co2e, Decimal('56.154500'))    # AR5: CH4 28, N2O 265
        self.assertEqual(get('ghg', 'natural-gas').factor_kg_co2e, Decimal('56.154300'))     # AR6: CH4 27.0, N2O 273
        self.assertEqual(get('ipcc', 'natural-gas').factor_co2_kg_co2e, Decimal('56.100000'))
        # Coal per kg: (94 600 + 10 x 28 + 1.5 x 265) kg/TJ x 25.8 TJ/Gg.
        self.assertEqual(get('ipcc', 'coal').factor_kg_co2e, Decimal('2.458160'))
        # Fluorinated gases are the GWP itself; a blend is its composition.
        self.assertEqual((get('ipcc', 'sf6').factor_kg_co2e, get('ghg', 'sf6').factor_kg_co2e), (23500, 24300))
        self.assertEqual((get('ipcc', 'r410a').factor_kg_co2e, get('ghg', 'r410a').factor_kg_co2e),
                         (Decimal('1923.5'), Decimal('2255.5')))
        self.assertEqual(get('ghg', 'r134a').factor_hfc_kg_co2e, 1530)

    def test_an_ipcc_and_a_ghg_inventory_calculate_fuel_and_keep_national_electricity(self):
        for choice, standard, gas_kg in (('std_ipcc', 'ipcc', '20279.3900'), ('std_ghg', 'ghg', '20279.3200')):
            EmissionEntry.objects.filter(inventory=self.report).delete()
            ReportStep.objects.filter(report=self.report).delete()
            self.choose(choice)
            post_scenario(self.client, self.report)
            gas = EmissionEntry.objects.get(inventory=self.report, emission_factor__slug='natural-gas-m3')
            self.assertEqual((gas.emission_factor.standard, gas.calculated_co2e_kg), (standard, Decimal(gas_kg)))
            diesel = EmissionEntry.objects.get(inventory=self.report, emission_factor__slug='diesel')
            self.assertEqual(diesel.emission_factor.standard, standard)
            kwh = EmissionEntry.objects.filter(inventory=self.report, emission_factor__category='electricity')
            self.assertEqual([e.calculated_co2e_kg for e in kwh], [Decimal('20995.0000')])

    def test_a_source_the_standard_does_not_publish_is_noted_not_dropped_silently(self):
        from questionnaire.step_entries import uncalculated_notes
        self.choose('std_ipcc')
        post_scenario(self.client, self.report)                              # includes a freight row (Scope 3)
        self.assertFalse(EmissionEntry.objects.filter(inventory=self.report, emission_factor__slug='tm-01').exists())
        answers = dict(ReportStep.objects.filter(report=self.report).values_list('step_id', 'answer'))
        notes = [n for n in uncalculated_notes(answers, 2025, self.company, self.report) if n['step_id'] == 'K3C4-2']
        self.assertEqual(len(notes), 1)
        self.assertIn('the chosen standard (IPCC) publishes no factor for this source', notes[0]['en'])
        self.assertIn('seçilen standart (IPCC) bu kaynak için faktör yayımlamıyor', notes[0]['tr'])
        # What IS calculated carries no such note.
        self.assertFalse([n for n in uncalculated_notes(answers, 2025, self.company, self.report)
                          if n['step_id'] == '3A-5' and 'standard' in n['en']])


class MixNotesAndStandardChangeTests(_InventoryCase):
    def setUp(self):
        super().setUp()
        call_command('seed_ipcc_ghg_factors', verbosity=0)
        post_scenario(self.client, self.report)                              # answered on the catalogue
        self.choose('std_mix')
        sync_step_entries(self.user, self.company, self.report, 'D1')

    def notes(self, step):
        from questionnaire.step_entries import uncalculated_notes
        answers = dict(ReportStep.objects.filter(report=self.report).values_list('step_id', 'answer'))
        return [n['en'] for n in uncalculated_notes(answers, 2025, self.company, self.report) if n['step_id'] == step]

    def change(self, step, standard, **extra):
        return self.client.post(f'/api/questionnaire/{self.report.id}/step-standard/',
                                {'step': step, 'factor_standard': standard, **extra}, format='json')

    def test_notes_follow_the_standard_of_each_question(self):
        self.assertTrue(any('standard of this question is not chosen' in n for n in self.notes('3A-5')))
        self.assertEqual(self.change('3A-5', 'ipcc').status_code, 200)
        self.assertEqual(self.notes('3A-5'), [])                             # calculated: nothing to say
        self.assertTrue(any('standard of this question is not chosen' in n for n in self.notes('K3C4-2')))
        self.assertEqual(self.change('K3C4-2', 'ipcc').status_code, 200)
        self.assertTrue(any('(IPCC) publishes no factor' in n for n in self.notes('K3C4-2')))

    def test_changing_the_standard_of_an_answered_question_recalculates_at_once(self):
        r = self.change('3A-5', 'defra')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self.gas_kg(), [Decimal('20667.2000')])             # DEFRA 2025
        self.assertEqual(r.data['calc_feedback']['delta_kg'], 20667.2)
        r = self.change('3A-5', 'ipcc')
        self.assertEqual(self.gas_kg(), [Decimal('20279.3900')])             # IPCC, same saved answer
        self.assertEqual(ReportStep.objects.get(report=self.report, step_id='3A-5').answer['factor_standard'], 'ipcc')
        self.assertEqual(ReportStep.objects.get(report=self.report, step_id='3A-5').answer['answer']['natural_gas'], '10000 m³')

    def test_the_change_is_refused_where_it_does_not_apply(self):
        self.assertEqual(self.change('3A-5', 'epa').data['code'], 'factor_standard')
        self.assertEqual(self.change('A1', 'defra').data['code'], 'not_a_calculating_step')
        r = self.change('4B-2', 'defra', language='tr')                      # never answered
        self.assertEqual((r.status_code, r.data['code']), (409, 'not_answered'))
        self.assertIn('yanıtlanmadı', r.data['error'])
        self.choose('std_defra')
        r = self.change('3A-5', 'ipcc')
        self.assertEqual((r.status_code, r.data['code']), (409, 'not_mix'))


class ChatEntryStandardTests(_InventoryCase):
    """An entry made outside the questionnaire uses the standard of the inventory it joins."""

    def create(self, inventory):
        from emissions.factor_lookup import create_entry_from_activity
        return create_entry_from_activity(self.user, self.company, 'natural_gas', 100, 'm3', 2025, 3, inventory=inventory)

    def test_company_level_entry_keeps_the_catalogue(self):
        entry, err = self.create(None)
        self.assertIsNone(err)
        self.assertEqual(entry.calculated_co2e_kg, Decimal('202.0000'))

    def test_entry_joining_a_defra_inventory_uses_defra(self):
        self.choose('std_defra')
        entry, err = self.create(self.report)
        self.assertIsNone(err)
        self.assertEqual((entry.emission_factor.standard, entry.calculated_co2e_kg), ('defra', Decimal('206.6720')))

    def test_a_standard_without_the_factor_says_so_and_creates_nothing(self):
        self.choose('std_ipcc')                                              # IPCC rows are not seeded here
        entry, err = self.create(self.report)
        self.assertIsNone(entry)
        self.assertIn('(IPCC) publishes no factor', err)
        self.assertIn('faktör yayımlamıyor', err)

    def test_a_mix_inventory_sends_the_amount_to_the_questionnaire(self):
        self.choose('std_mix')
        entry, err = self.create(self.report)
        self.assertIsNone(entry)
        self.assertIn('enter this amount in the questionnaire', err)
        self.assertIn('ankette girin', err)
