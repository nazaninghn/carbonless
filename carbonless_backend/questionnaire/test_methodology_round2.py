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
