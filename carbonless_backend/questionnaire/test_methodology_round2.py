"""QA round 2 (2026-10-19): a leased building counted in Scope 2 and again in
Scope 3 Category 8; a franchise answer that promised an estimate and was filed
as "not applicable"; catalog codes and factor slugs shown to users."""
import json
from pathlib import Path

from .models import AdvisorApproval, ReportStep
from .test_input_integrity import _Inventory

LEASED_OFFICE = {'asset_type': 'KV-01', 'area_m2': '2500', 'owner_declaration': True,
                 'declaration_kwh': '120000', 'declaration_energy': 'electricity'}


class _Round2(_Inventory):
    def setUp(self):
        super().setUp()
        self._factor('turkey-grid', 'kwh', 0.469, scope='scope2', country='turkey')

    def _boundary(self, approach):
        # D3 is a strict step: its validated data is stored as the answer.
        ReportStep.objects.update_or_create(report=self.report, step_id='D3',
                                            defaults={'answer': {'boundary_approach': approach}})

    def _patch(self, step, answer):
        return self.client.patch(f'/api/questionnaire/{self.report.id}/step/', {
            'step': step, 'data': {'answer': answer}, 'language': 'en'}, format='json')

    def _leased_kg(self):
        return [round(float(e.calculated_co2e_kg), 2) for e in self._entries()
                if e.emission_factor.category == 'upstream_leased']

    def _notes(self, step):
        from .step_entries import uncalculated_notes
        answers = dict(ReportStep.objects.filter(report=self.report).values_list('step_id', 'answer'))
        return [n for n in uncalculated_notes(answers, 2025, self.company) if n['step_id'] == step]


class LeasedBuildingDoubleCountTests(_Round2):
    def setUp(self):
        super().setUp()
        self._step('K3C8-0', 'yes')

    def test_a_leased_site_already_in_scope2_is_not_counted_again(self):
        self._boundary('operational_control')
        r = self._patch('K3C8-1', {'items': [{**LEASED_OFFICE, 'in_scope12': 'included'}], 'draft': {}})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self._leased_kg(), [])
        notes = self._notes('K3C8-1')
        self.assertEqual([n['kind'] for n in notes], ['method'])
        self.assertIn('not counted again in Category 8', notes[0]['en'])
        self.assertIn('Leased office building', notes[0]['en'])  # named, not "KV-01"

    def test_a_leased_asset_outside_scope2_is_still_counted(self):
        self._boundary('operational_control')
        r = self._patch('K3C8-1', {'items': [{**LEASED_OFFICE, 'in_scope12': 'not_included'}], 'draft': {}})
        self.assertEqual(r.status_code, 200, r.content)
        # The manually verified calculation is unchanged: 120,000 kWh × 0.469.
        self.assertEqual(self._leased_kg(), [56280.0])

    def test_a_new_answer_must_say_whether_it_is_already_in_scope2(self):
        r = self._patch('K3C8-1', {'items': [LEASED_OFFICE], 'draft': {}})
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn('in_scope12', r.data['error'])

    def test_an_earlier_answer_keeps_its_calculation_and_is_flagged(self):
        # Saved before the question asked it (straight into the table): the
        # calculation is preserved; under Operational Control a note says the
        # building may be counted twice.
        from .step_entries import resync_inventory
        self._boundary('operational_control')
        ReportStep.objects.create(report=self.report, step_id='K3C8-1',
                                  answer={'answer': {'items': [LEASED_OFFICE], 'draft': {}}})
        resync_inventory(self.company, 2025, self.user)
        self.assertEqual(self._leased_kg(), [56280.0])
        self.assertTrue(any('may be counted twice' in n['en'] for n in self._notes('K3C8-1')))

    def test_no_double_count_warning_outside_operational_control(self):
        from .step_entries import resync_inventory
        self._boundary('financial_control')
        ReportStep.objects.create(report=self.report, step_id='K3C8-1',
                                  answer={'answer': {'items': [LEASED_OFFICE], 'draft': {}}})
        resync_inventory(self.company, 2025, self.user)
        self.assertEqual(self._leased_kg(), [56280.0])
        self.assertFalse(any('counted twice' in n['en'] for n in self._notes('K3C8-1')))


class LeasedAssetFacilityIdentityTests(_Round2):
    """A leased asset is tied to one of the company's registered facilities by
    the facility list (its identity), and the inventory's own Scope 1/2 entries
    are the evidence that it is already counted — not the self-declared flag,
    and not name similarity."""
    SITES = {'1': {'name': 'Gebze', 'country': 'TR', 'grid_connection': 'distribution'},
             '2': {'name': 'Gebze Depo', 'country': 'TR', 'grid_connection': 'distribution'}}

    def setUp(self):
        super().setUp()
        self._step('2A-2', self.SITES)
        self._step('K3C8-0', 'yes')
        self._boundary('operational_control')

    def _lease(self, facility=None, in_scope12='not_included'):
        row = {**LEASED_OFFICE, 'in_scope12': in_scope12}
        if facility is not None:
            row['facility'] = facility
        r = self._patch('K3C8-1', {'items': [row], 'draft': {}})
        self.assertEqual(r.status_code, 200, r.content)

    def _electricity(self, answer):
        self._step('4A-1', answer)

    def test_a_site_whose_electricity_is_in_scope2_is_not_counted_even_if_answered_no(self):
        self._electricity({'1': '1000 kWh'})
        self._lease('Gebze', in_scope12='not_included')      # the answer says "No", the entries say otherwise
        self.assertEqual(self._leased_kg(), [])
        [note] = [n for n in self._notes('K3C8-1') if n['kind'] == 'method']
        self.assertIn('already reported in Scope 1/2', note['en'])
        self.assertIn('Gebze', note['en'])
        self.assertIn('Leased office building', note['en'])    # named, not "KV-01"

    def test_identity_is_the_listed_facility_not_a_similar_name(self):
        self._electricity({'2': '1000 kWh'})                  # only "Gebze Depo" has Scope 2 electricity
        self._lease('Gebze', in_scope12='not_included')        # "Gebze" is another site
        self.assertEqual(self._leased_kg(), [56280.0])

    def test_the_link_is_not_case_sensitive(self):
        self._electricity({'1': '1000 kWh'})
        self._lease('GEBZE')
        self.assertEqual(self._leased_kg(), [])

    def test_a_registered_site_without_scope2_entries_is_still_counted_and_told_where_it_belongs(self):
        self._lease('Gebze')                                  # no 4A-1 yet: nothing is lost
        self.assertEqual(self._leased_kg(), [56280.0])
        self.assertTrue(any('registered site' in n['en'] and 'Question 68' in n['en']
                            for n in self._notes('K3C8-1')))

    def test_entering_the_sites_electricity_later_stops_the_double_count(self):
        self._lease('Gebze')
        self.assertEqual(self._leased_kg(), [56280.0])
        self._electricity({'1': '1000 kWh'})                  # the inventory resyncs on this save
        self.assertEqual(self._leased_kg(), [])

    def test_electricity_that_the_inventory_turned_off_is_not_evidence(self):
        self._step('4A-0', 'no')                              # gate closed: 4A-1 reaches no entry
        self._electricity({'1': '1000 kWh'})
        self._lease('Gebze')
        self.assertEqual(self._leased_kg(), [56280.0])

    def test_a_link_set_back_to_blank_is_no_link(self):
        """The select was changed to a facility and back to "— Select —": the
        stored value is an empty string, which must behave as no link at all."""
        self._electricity({'1': '1000 kWh'})
        self._lease('', in_scope12='not_included')
        self.assertEqual(self._leased_kg(), [56280.0])        # counted, as with no facility
        self.assertEqual([n for n in self._notes('K3C8-1') if 'registered site' in n['en']], [])

    def test_an_asset_without_a_facility_keeps_the_declaration_rule(self):
        self._electricity({'1': '1000 kWh'})
        self._lease(None, in_scope12='not_included')           # unchanged: counted
        self.assertEqual(self._leased_kg(), [56280.0])
        self._lease(None, in_scope12='included')               # unchanged: not counted
        self.assertEqual(self._leased_kg(), [])



class LegacyLeasedRowReviewTests(_Round2):
    """A leased-asset row saved before question 97 asked "already in Scope 1/2?"
    and tied to no facility may overlap with Scope 1/2. It stays counted — it is
    never left out on a guess, and never by name — but it is surfaced for a
    person's review in the inventory's notes and by a read-only command."""
    SITES = {'1': {'name': 'Gebze', 'country': 'TR', 'grid_connection': 'distribution'}}

    def setUp(self):
        super().setUp()
        self._step('2A-2', self.SITES)
        self._step('K3C8-0', 'yes')

    def _legacy(self, **extra):
        """A K3C8-1 row exactly as it was saved before the question existed."""
        ReportStep.objects.update_or_create(
            report=self.report, step_id='K3C8-1',
            defaults={'answer': {'answer': {'items': [{**LEASED_OFFICE, **extra}], 'draft': {}}}})
        from .step_entries import resync_inventory
        resync_inventory(self.company, 2025, self.user)

    def _review_notes(self):
        return [n for n in self._notes('K3C8-1') if 'counted twice' in n['en']]

    def _command(self, *args):
        import io
        from django.core.management import call_command
        out = io.StringIO()
        call_command('review_leased_assets', *args, stdout=out)
        return out.getvalue()

    def _snapshot(self):
        return ([(e.pk, e.emission_factor_id, str(e.quantity), str(e.calculated_co2e_kg)) for e in self._entries()],
                list(ReportStep.objects.filter(report=self.report).order_by('step_id').values_list('step_id', 'answer')))

    def test_a_legacy_row_is_counted_and_flagged_when_the_inventory_has_scope12_energy(self):
        self._boundary('financial_control')                   # not the Operational Control note
        self._step('4A-1', {'1': '1000 kWh'})
        self._legacy()
        self.assertEqual(self._leased_kg(), [56280.0])        # still counted: nothing is left out on a guess
        [note] = self._review_notes()
        self.assertIn('not linked to a facility', note['en'])
        self.assertEqual(note['kind'], 'method')

    def test_no_flag_without_any_sign_of_overlap(self):
        self._boundary('financial_control')                   # no Scope 1/2 energy answered at all
        self._legacy()
        self.assertEqual(self._leased_kg(), [56280.0])
        self.assertEqual(self._review_notes(), [])

    def test_a_similar_name_never_excludes_or_clears_a_row(self):
        self._boundary('financial_control')
        self._step('4A-1', {'1': '1000 kWh'})
        self._legacy(name='Gebze', description='Gebze Fabrika', site='Gebze')   # a name, but no facility link
        self.assertEqual(self._leased_kg(), [56280.0])        # not excluded by name
        self.assertEqual(len(self._review_notes()), 1)        # and still flagged

    def test_leased_equipment_has_no_site_to_overlap(self):
        self._boundary('operational_control')
        self._step('4A-1', {'1': '1000 kWh'})
        self._legacy(asset_type='KV-04')
        self.assertEqual(self._review_notes(), [])

    def test_a_row_that_answered_the_question_is_not_nagged(self):
        self._boundary('operational_control')
        self._step('4A-1', {'1': '1000 kWh'})
        self._legacy(in_scope12='not_included')
        self.assertEqual(self._leased_kg(), [56280.0])
        self.assertEqual(self._review_notes(), [])

    def test_the_command_lists_the_row_and_changes_nothing(self):
        self._boundary('operational_control')
        self._step('4A-1', {'1': '1000 kWh'})
        self._legacy()
        before = self._snapshot()
        out = self._command()
        self.assertIn(f'inventory #{self.report.pk} 2025 [draft]', out)
        self.assertIn('KV-01', out)
        self.assertIn('reasons: operational_control, scope12_energy', out)
        self.assertIn('counted in Category 8: yes', out)
        self.assertIn('1 leased-asset row(s) to review', out)
        self.assertIn('Nothing was changed', out)
        self.assertEqual(self._snapshot(), before)             # read-only
        self.assertEqual(self._leased_kg(), [56280.0])

    def test_the_command_skips_linked_answered_and_other_companies_rows(self):
        self._boundary('operational_control')
        self._step('4A-1', {'1': '1000 kWh'})
        self._legacy(in_scope12='not_included')                # answered
        self.assertIn('0 leased-asset row(s) to review', self._command())
        self._legacy(facility='Gebze')                         # linked
        self.assertIn('0 leased-asset row(s) to review', self._command())
        self._legacy()
        self.assertIn('0 leased-asset row(s) to review', self._command('--company', str(self.company.pk + 999)))
        self.assertIn('1 leased-asset row(s) to review', self._command('--company', str(self.company.pk)))

    def test_renaming_the_facility_keeps_a_linked_row_protecting_against_the_double_count(self):
        from companies.models import Facility
        self._boundary('operational_control')
        self._step('4A-1', {'1': '1000 kWh'})
        ReportStep.objects.update_or_create(
            report=self.report, step_id='K3C8-1',
            defaults={'answer': {'answer': {'items': [{**LEASED_OFFICE, 'in_scope12': 'not_included',
                                                       'facility': 'Gebze'}], 'draft': {}}}})
        gebze = Facility.objects.get(company=self.company, name='Gebze')
        r = self.client.patch(f'/api/companies/facilities/{gebze.pk}/', {'name': 'Gebze Fabrika'}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        step = ReportStep.objects.get(report=self.report, step_id='K3C8-1')
        self.assertEqual(step.answer['answer']['items'][0]['facility'], 'Gebze Fabrika')   # the link followed
        self._step('4A-1', {'1': '1200 kWh'})                  # resync: the row is still recognised as the site
        self.assertEqual(self._leased_kg(), [])


class FranchiseStatusTests(_Round2):
    def _flags(self):
        return list(AdvisorApproval.objects.filter(report=self.report, question_id='K3C14-0')
                    .values_list('reason_code', flat=True))

    def test_no_data_is_not_filed_as_not_applicable(self):
        self._step('K3C14-0', 'no')
        self.assertEqual(self._flags(), ['k3_category_no_data'])
        self._step('K3C14-0', 'na')
        self.assertEqual(self._flags(), ['k3_category_no'])

    def test_report_says_recorded_and_not_calculated(self):
        self._step('K3C14-0', 'no')
        self._step('K3C14-2', {'franchise_count': '2500', 'total_area_m2': '2500'})
        self.assertFalse([e for e in self._entries() if e.emission_factor.category == 'franchises'])
        [note] = self._notes('K3C14-2')
        self.assertIn('Franchises (2,500 outlets, 2,500 m²): not calculated', note['en'])
        self.assertIn('The category applies', note['en'])
        self.assertNotIn('estimate', note['en'].lower())

    def test_the_option_no_longer_promises_an_estimate(self):
        labels = json.loads((Path(__file__).resolve().parent / 'data' / 'carboniq_labels.json').read_text(encoding='utf-8'))
        for lang in ('en', 'tr'):
            words = labels['K3C14-0']['options']['no'][lang].lower()
            self.assertNotIn('estimate' if lang == 'en' else 'tahmin', words)
        schema = json.loads((Path(__file__).resolve().parent / 'data' / 'carboniq_schema.json').read_text(encoding='utf-8'))
        self.assertEqual(schema['K3C14-0']['options'], ['yes', 'no', 'na'])  # stored values unchanged
        self.assertTrue(schema['K3C14-2']['notCalculated'])


class ReadableDescriptionTests(_Round2):
    def setUp(self):
        super().setUp()
        self._boundary('operational_control')
        self._step('K3C8-0', 'yes')
        self._patch('K3C8-1', {'items': [{**LEASED_OFFICE, 'in_scope12': 'not_included'}], 'draft': {}})
        [self.entry] = [e for e in self._entries() if e.emission_factor.category == 'upstream_leased']

    def test_stored_text_keeps_the_codes_for_traceability(self):
        self.assertIn('KV-01', self.entry.calc_detail['en'])
        self.assertIn('turkey-grid-distribution', self.entry.calc_detail['en'])
        self.assertTrue(self.entry.description.startswith('Questionnaire step K3C8-1'))

    def test_emissions_list_shows_names(self):
        r = self.client.get('/api/emissions/entries/?year=2025')
        rows = r.data['results'] if isinstance(r.data, dict) else r.data
        row = next(x for x in rows if x['id'] == self.entry.id)
        for lang, office, grid in (('en', 'Leased office building', 'Turkey grid'),
                                   ('tr', 'Kiralık ofis binası', 'Türkiye şebekesi')):
            text = row['calc_detail'][lang]
            self.assertIn(office, text)
            self.assertIn(grid, text)
            self.assertNotIn('KV-01', text)
            self.assertNotIn('turkey-grid-distribution', text)

    def test_exports_and_iso_report_show_names(self):
        from emissions.descriptions import display_description
        from .iso_report_pdf import _gather
        shown = display_description(self.entry.description, 'en', self.entry.calc_detail)
        self.assertIn('Leased office building', shown)
        self.assertNotIn('KV-01', shown)
        self.report.status = self.report.Status.COMPLETED
        self.report.save()
        data = _gather(self.report, 'en')
        # The source rows the detail tables print (data['answers'] is the raw
        # stored answers — codes there are data, shown through their labels).
        references = json.dumps(data['sources'], default=str, ensure_ascii=False)
        self.assertIn('Leased office building', references)
        self.assertNotIn('KV-01', references)
        self.assertNotIn('(turkey-grid-distribution)', references)
