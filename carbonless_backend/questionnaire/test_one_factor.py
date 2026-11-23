"""One source has one factor in an inventory, wherever it is entered.

The questionnaire, the dashboard form, the AI chat and the Workspace must put
the same litre or m³ on the same EmissionFactor row: the row of the
inventory's factor standard (question D1) and year. `emissions/entry_standard.py`.
"""
from decimal import Decimal

from emissions.entry_standard import off_standard_entries
from emissions.factor_lookup import use_standard
from emissions.models import EmissionEntry, EmissionFactor
from questionnaire.models import CarbonReport, ReportStep
from questionnaire.test_calc_baseline import post_scenario
from questionnaire.test_factor_standards import _InventoryCase, defra

DEFRA_GAS = Decimal('2.06672')       # the 2025 edition seeded by _InventoryCase
CATALOGUE_GAS = Decimal('2.02')


class _Case(_InventoryCase):
    def catalogue(self, slug):
        return EmissionFactor.objects.get(slug=slug, standard='', is_default=True)

    def post_form(self, slug, quantity=100, year=2025, **extra):
        return self.client.post('/api/emissions/entries/', {
            'emission_factor': self.catalogue(slug).pk, 'year': year, 'month': 3, 'quantity': quantity,
            'description': 'form', 'confirm_duplicate': True, **extra}, format='json')

    def chat(self, inventory=None, activity='natural_gas', unit='m3'):
        from emissions.factor_lookup import create_entry_from_activity
        return create_entry_from_activity(self.user, self.company, activity, 100, unit, 2025, 4, inventory=inventory)


class SameFactorEverywhereTests(_Case):
    def test_questionnaire_form_and_chat_use_the_same_row_in_a_defra_inventory(self):
        self.choose('std_defra')
        post_scenario(self.client, self.report, gas='100 m³')
        questionnaire = EmissionEntry.objects.get(inventory=self.report, emission_factor__slug='natural-gas-m3')
        form = self.post_form('natural-gas-m3')
        self.assertEqual(form.status_code, 201, form.content)
        chat, err = self.chat()
        self.assertIsNone(err)
        rows = {questionnaire.emission_factor_id, form.data['emission_factor'], chat.emission_factor_id}
        self.assertEqual(len(rows), 1)                                   # one row, three ways in
        self.assertEqual(questionnaire.emission_factor.factor_kg_co2e, DEFRA_GAS)
        for kg in (questionnaire.calculated_co2e_kg, EmissionEntry.objects.get(pk=form.data['id']).calculated_co2e_kg,
                   chat.calculated_co2e_kg):
            self.assertEqual(kg, Decimal('206.6720'))                    # 100 m³ × 2.06672

    def test_a_catalogue_inventory_keeps_the_catalogue_everywhere(self):
        post_scenario(self.client, self.report, gas='100 m³')
        questionnaire = EmissionEntry.objects.get(inventory=self.report, emission_factor__slug='natural-gas-m3')
        form = self.post_form('natural-gas-m3')
        chat, _ = self.chat()
        self.assertEqual({questionnaire.emission_factor_id, form.data['emission_factor'], chat.emission_factor_id},
                         {self.catalogue('natural-gas-m3').pk})
        self.assertEqual(chat.calculated_co2e_kg, Decimal('202.0000'))   # 100 m³ × 2.02, unchanged

    def test_regression_guard_natural_gas_on_the_catalogue(self):
        r = self.post_form('natural-gas-m3', quantity=10000)
        self.assertEqual(EmissionEntry.objects.get(pk=r.data['id']).calculated_co2e_kg, Decimal('20200.0000'))

    def test_the_form_refuses_a_source_the_standard_does_not_publish(self):
        self.choose('std_defra')                                          # no DEFRA diesel row here
        r = self.post_form('diesel')
        self.assertEqual(r.status_code, 400, r.content)
        self.assertEqual(r.data['code'], 'factor_standard')
        self.assertIn('(DEFRA) publishes no factor', r.data['message_en'])
        self.assertIn('faktör yayımlamıyor', r.data['message_tr'])
        self.assertFalse(EmissionEntry.objects.filter(description='form').exists())

    def test_a_mix_inventory_sends_the_form_entry_to_the_questionnaire(self):
        self.choose('std_mix')
        r = self.post_form('natural-gas-m3')
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn('enter this amount in the questionnaire', r.data['message_en'])
        self.assertIn('ankette girin', r.data['message_tr'])

    def test_a_year_with_several_inventories_and_none_named_stays_on_the_catalogue(self):
        self.choose('std_defra')
        CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025)
        chat, err = self.chat()
        self.assertIsNone(err)
        self.assertEqual(chat.emission_factor.standard, '')               # read by no inventory: company level
        named, _ = self.chat(self.report)
        self.assertEqual(named.emission_factor.standard, 'defra')

    def test_grid_electricity_is_the_national_factor_in_every_standard(self):
        self.choose('std_defra')
        grid = self.catalogue('turkey-grid-distribution')
        r = self.post_form('turkey-grid-distribution', quantity=1000)
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data['emission_factor'], grid.pk)

    def test_changing_the_source_of_an_entry_restates_it_on_the_standard(self):
        defra('diesel', 2025, Decimal('2.5'), unit='liters')
        self.choose('std_defra')
        r = self.post_form('natural-gas-m3', inventory_id=self.report.pk)
        edited = self.client.patch(f"/api/emissions/entries/{r.data['id']}/",
                                   {'emission_factor': self.catalogue('diesel').pk}, format='json')
        self.assertEqual(edited.status_code, 200, edited.content)
        entry = EmissionEntry.objects.get(pk=r.data['id'])
        self.assertEqual((entry.emission_factor.standard, entry.calculated_co2e_kg), ('defra', Decimal('250.0000')))


class FactorListTests(_Case):
    def slugs(self, query=''):
        r = self.client.get(f'/api/emissions/factors/{query}')
        self.assertEqual(r.status_code, 200)
        return {(f['slug'], f['standard'], Decimal(f['factor_kg_co2e'])) for f in r.data}

    def test_without_an_inventory_the_list_is_the_catalogue(self):
        self.choose('std_defra')
        rows = self.slugs()
        self.assertIn(('natural-gas-m3', '', Decimal('2.020000')), rows)
        self.assertFalse([r for r in rows if r[1]])

    def test_the_list_of_a_defra_inventory_shows_what_it_calculates_with(self):
        self.choose('std_defra')
        rows = self.slugs(f'?inventory_id={self.report.pk}')
        self.assertIn(('natural-gas-m3', 'defra', DEFRA_GAS), rows)
        self.assertNotIn('diesel', {r[0] for r in rows})                  # not published: not offered
        self.assertIn('turkey-grid-distribution', {r[0] for r in rows})   # the national grid stays

    def test_the_list_of_a_catalogue_inventory_is_the_catalogue(self):
        self.assertEqual(self.slugs(f'?inventory_id={self.report.pk}'), self.slugs())

    def test_another_companys_inventory_changes_nothing(self):
        from companies.models import Company
        elsewhere = Company.objects.create(
            legal_entity_name='Other Co', tax_number='9', country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1)
        other = CarbonReport.objects.create(company=elsewhere, created_by=self.user, reporting_year=2025)
        ReportStep.objects.create(report=other, step_id='D1', answer={'ef_database': 'std_defra'})
        self.assertEqual(self.slugs(f'?inventory_id={other.pk}'), self.slugs())


class StandardChosenLaterTests(_Case):
    """Entries made before the standard was chosen follow it; what it does not publish is said, not hidden."""

    def test_choosing_the_standard_moves_the_outside_entries_to_it(self):
        gas, diesel = self.post_form('natural-gas-m3'), self.post_form('diesel')
        self.assertEqual(EmissionEntry.objects.get(pk=gas.data['id']).calculated_co2e_kg, Decimal('202.0000'))
        r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                              {'step': 'D1', 'data': {'ef_database': 'std_defra'}}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        moved = EmissionEntry.objects.get(pk=gas.data['id'])
        self.assertEqual((moved.emission_factor.standard, moved.quantity, moved.calculated_co2e_kg),
                         ('defra', Decimal('100'), Decimal('206.6720')))
        self.assertEqual(moved.factor_value_snapshot, DEFRA_GAS)
        # DEFRA has no diesel row here: the entry is kept exactly as it was and named on the dashboard.
        kept = EmissionEntry.objects.get(pk=diesel.data['id'])
        self.assertEqual((kept.emission_factor.standard, kept.calculated_co2e_kg), ('', Decimal('300.0000')))
        self.assertEqual([e.pk for e, _ in off_standard_entries(self.report)], [kept.pk])
        summary = self.client.get(f'/api/emissions/summary/?year=2025&inventory_id={self.report.pk}').data
        self.assertEqual(summary['factor_standard'], 'defra')
        self.assertEqual([n['entry_id'] for n in summary['off_standard_notes']], [kept.pk])
        self.assertIn('publishes no factor', summary['off_standard_notes'][0]['en'])
        self.assertIn('faktör yayımlamıyor', summary['off_standard_notes'][0]['tr'])

    def test_a_catalogue_inventory_reports_nothing(self):
        self.post_form('diesel')
        summary = self.client.get(f'/api/emissions/summary/?year=2025&inventory_id={self.report.pk}').data
        self.assertEqual((summary['factor_standard'], summary['off_standard_notes']), ('', []))


class ChatTests(_Case):
    def test_the_preview_card_uses_the_only_inventory_of_the_year(self):
        from chat.views import _build_pending_entries_from_data
        self.choose('std_defra')
        cards = _build_pending_entries_from_data(
            [{'fuel_type': 'natural_gas', 'quantity': 100, 'unit': 'm3', 'year': 2025, 'month': 3}], self.user)
        self.assertEqual(Decimal(str(cards[0]['factor_used'])), DEFRA_GAS)
        self.assertEqual(cards[0]['co2e_kg'], 206.672)

    def test_the_factor_reference_quotes_the_standard_in_force(self):
        from emissions.factor_lookup import get_emission_factor_reference
        catalogue = get_emission_factor_reference()
        self.assertIn('m3=2.020000', catalogue)
        self.assertNotIn('Factor standard of the selected inventory', catalogue)
        with use_standard('defra'):
            text = get_emission_factor_reference(2025)
        self.assertIn('Factor standard of the selected inventory: DEFRA', text)
        self.assertIn('m3=2.066720', text)
        self.assertNotIn('m3=2.020000', text)


class StandardChangedTests(_Case):
    def test_changing_the_standard_recalculates_the_answers_at_once(self):
        post_scenario(self.client, self.report, gas='100 m³')
        self.assertEqual(self.gas_kg(), [Decimal('202.0000')])
        r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/',
                              {'step': 'D1', 'data': {'ef_database': 'std_defra'}}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self.gas_kg(), [Decimal('206.6720')])           # no other question had to be saved again


class FormFactorListTests(_Case):
    """`?entry_year=`: the list the dashboard form shows is the list its entries are saved with."""

    def gas(self, query):
        return {Decimal(f['factor_kg_co2e']) for f in self.client.get(f'/api/emissions/factors/{query}').data
                if f['slug'] == 'natural-gas-m3'}

    def test_the_only_inventory_of_the_year_decides(self):
        self.choose('std_defra')
        self.assertEqual(self.gas('?entry_year=2025'), {DEFRA_GAS})
        self.assertEqual(self.gas('?entry_year=2024'), {CATALOGUE_GAS})       # no inventory that year

    def test_several_inventories_in_the_year_leave_the_catalogue(self):
        self.choose('std_defra')
        CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025)
        self.assertEqual(self.gas('?entry_year=2025'), {CATALOGUE_GAS})
        r = self.post_form('natural-gas-m3')                                  # and that is what is saved
        self.assertEqual(EmissionEntry.objects.get(pk=r.data['id']).emission_factor.standard, '')
