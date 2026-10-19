"""Answers that used to be accepted although they could not be true, or were
accepted and then silently not used (QA walkthrough of 2026-10-19).

Each test saves through the real step endpoint, so the rule is checked where
it protects the inventory: the server, not only the questionnaire."""
import json
from pathlib import Path

from .models import ReportStep
from . import tests as _base


class _Inventory(_base.TestCase):
    """StepEntriesTests' company, 2025 report and helpers — without
    inheriting (and so re-running) its tests."""
    setUp = _base.StepEntriesTests.setUp
    _factor = _base.StepEntriesTests._factor
    _step = _base.StepEntriesTests._step
    _entries = _base.StepEntriesTests._entries


class _Patch(_Inventory):
    def _patch(self, step, answer, lang='en'):
        return self.client.patch(f'/api/questionnaire/{self.report.id}/step/', {
            'step': step, 'data': {'answer': answer}, 'language': lang}, format='json')

    def assertRejected(self, response, text):
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn(text, response.data['error'])
        self.assertFalse(response.data['success'])


class CommuteBoundsTests(_Patch):
    def test_office_days_per_week_is_0_to_7(self):
        self.assertRejected(self._patch('K3C7-2', '40'), 'between 0 and 7')
        self.assertFalse(ReportStep.objects.filter(report=self.report, step_id='K3C7-2').exists())
        self.assertEqual(self._patch('K3C7-2', '3').status_code, 200)

    def test_one_way_distance_is_at_most_300_km(self):
        self.assertRejected(self._patch('K3C7-4', '15000'), 'between 0 and 300 km')
        self.assertEqual(self._patch('K3C7-4', '18').status_code, 200)

    def test_ev_commuters_at_most_the_staff_who_come_in(self):
        self._step('K3C7-1', {'fulltime_count': '40', 'hybrid_count': '40', 'remote_count': '40'})
        # Remote staff do not commute: 40 + 40 = 80 is the limit.
        r = self._patch('K3C7-5', '120000')
        self.assertRejected(r, 'cannot exceed the employees who come to the office (80')
        self.assertRejected(self._patch('K3C7-5', '81'), '(80')
        self.assertEqual(self._patch('K3C7-5', '80').status_code, 200)

    def test_turkish_message(self):
        self.assertRejected(self._patch('K3C7-2', '40', lang='tr'), '0 ile 7 arasında')


class GroupAndRefillTests(_Patch):
    def test_more_than_20_groups_is_refused_not_cut_to_20(self):
        r = self._patch('3A-2', {'EQ-3A-07': {'unit_count': '8000', 'site': 'Fabrika', 'group_count': '8000'}})
        self.assertRejected(r, 'At most 20 different groups')
        ok = self._patch('3A-2', {'EQ-3A-07': {'unit_count': '8000', 'site': 'Fabrika', 'group_count': '20'}})
        self.assertEqual(ok.status_code, 200)

    def test_group_count_not_above_unit_count_inside_a_loop(self):
        # notAbove used to be checked only for a one-shot compound, never per
        # loop item, so this passed the server.
        r = self._patch('3B-3', {'EQ-3B-01': {'unit_count': '2', 'site': 'X', 'size_band': 'car_small', 'group_count': '5'}})
        self.assertRejected(r, 'cannot exceed the number of units')

    def test_refill_not_above_system_capacity(self):
        r = self._patch('3D-4', {'EQ-3D-01': {'refill_kg': '50000', 'capacity_kg': '8'}})
        self.assertRejected(r, 'cannot be larger than the system capacity')
        self.assertEqual(self._patch('3D-4', {'EQ-3D-01': {'refill_kg': '2.5', 'capacity_kg': '8'}}).status_code, 200)
        # Capacity is optional: nothing to compare with.
        self.assertEqual(self._patch('3D-4', {'EQ-3D-01': {'refill_kg': '2.5'}}).status_code, 200)


class DuplicateRowTests(_Patch):
    EXCEPTION = {'exception_description': 'Supplier factor for gas', 'materiality_pct': '2', 'justification': 'Invoice'}

    def test_same_exception_twice_is_refused(self):
        twice = {'items': [self.EXCEPTION, {**self.EXCEPTION, 'justification': ' invoice '}], 'draft': {}}
        self.assertRejected(self._patch('6C-2', twice), 'in the list twice')
        other = {**self.EXCEPTION, 'exception_description': 'Boundary: canteen excluded'}
        self.assertEqual(self._patch('6C-2', {'items': [self.EXCEPTION, other], 'draft': {}}).status_code, 200)

    def test_other_repeatable_lists_may_repeat_a_row(self):
        # Two identical shipments are two shipments: only lists marked
        # uniqueItems (exclusions, exceptions) refuse a repeat.
        row = {'transport_mode': 'TM-01', 'load_tonne': '5', 'distance_km': '100'}
        self.assertEqual(self._patch('K3C4-2', {'items': [row, row], 'draft': {}}).status_code, 200)


class SupplierFactorPlausibilityTests(_Patch):
    """A document's factor is compared with the amounts it applies to."""

    def setUp(self):
        super().setUp()
        self._factor('natural-gas-m3', 'm3', 2.02, scope='scope1')
        self._factor('cement-clinker', 'tonnes', 525, scope='scope1')
        self._step('3A-0', 'yes')
        self._step('3A-5', {'natural_gas': '50000 m³'})
        self._step('3A-EF', 'yes')

    def _doc(self, value, unit, year='2025'):
        return {'ef_value': value, 'ef_unit': unit, 'ef_source': 'XYZ Gaz A.Ş. beyanı', 'ef_year': year}

    def _kg(self):
        return sorted(round(float(e.calculated_co2e_kg), 2) for e in self._entries())

    def test_fifty_times_the_reference_is_refused(self):
        r = self._patch('3A-EF-a', self._doc('100', 'kgCO2e_m3'))
        self.assertRejected(r, 'times the reference factor')
        self.assertIn('2.02', r.data['error'])
        # The inventory keeps the generic factor: 50,000 m³ × 2.02.
        self.assertEqual(self._kg(), [101000.0])

    def test_a_plausible_supplier_factor_is_applied(self):
        self.assertEqual(self._patch('3A-EF-a', self._doc('2.05', 'kgCO2e_m3')).status_code, 200)
        self.assertEqual(self._kg(), [102500.0])

    def test_a_factor_in_no_amount_unit_is_refused(self):
        r = self._patch('3A-EF-a', self._doc('0.2', 'kgCO2e_litre'))
        self.assertRejected(r, 'does not match the unit of the amounts')
        self.assertIn('m³', r.data['error'])

    def test_facility_process_factor_in_the_wrong_unit_is_refused_not_dropped(self):
        self._step('3C-0', 'yes')
        self._step('3C-2', {'EQ-3C-01': {'quantity': '50000', 'method': 'cems_tier3'}})
        self._step('3C-EF', 'yes')
        self.assertRejected(self._patch('3C-EF-a', self._doc('0.825', 'kgCO2e_m3')),
                            'does not match the unit of the amounts')
        self.assertRejected(self._patch('3C-EF-a', self._doc('0.825', 'kgCO2e_tonne_product')),
                            'times the reference factor')
        self.assertEqual(self._patch('3C-EF-a', self._doc('510', 'kgCO2e_tonne_product')).status_code, 200)
        self.assertIn(25500000.0, self._kg())

    def test_an_implausible_factor_saved_before_is_not_applied_and_is_reported(self):
        from .step_entries import resync_inventory, uncalculated_notes
        # Saved before the step refused it (straight into the table).
        ReportStep.objects.create(report=self.report, step_id='3A-EF-a', answer={'answer': self._doc('100', 'kgCO2e_m3')})
        resync_inventory(self.company, 2025, self.user)
        self.assertEqual(self._kg(), [101000.0])
        answers = dict(ReportStep.objects.filter(report=self.report).values_list('step_id', 'answer'))
        notes = [n['en'] for n in uncalculated_notes(answers, 2025, self.company)]
        self.assertTrue(any('factor was not used' in n and 'times the reference' in n for n in notes), notes)


class NotCalculatedOptionsTests(_Inventory):
    """The questionnaire marks the options with no factor as "recorded, not
    calculated yet" — the same ones step_entries.py does not calculate."""

    def _schema(self):
        path = Path(__file__).resolve().parent / 'data' / 'carboniq_schema.json'
        return json.loads(path.read_text(encoding='utf-8'))

    def test_vehicle_and_process_flags_match_the_calculation(self):
        from .step_entries import _OFFROAD_MACHINES, _PROCESS_SLUG, _ROAD_VEHICLES
        schema = self._schema()
        vehicles = set(schema['3B-1']['options'])
        self.assertEqual(set(schema['3B-1']['notCalculatedOptions']),
                         vehicles - _ROAD_VEHICLES - _OFFROAD_MACHINES)
        processes = set(schema['3C-1']['options'])
        self.assertEqual(set(schema['3C-1']['notCalculatedOptions']), processes - set(_PROCESS_SLUG))

    def test_whole_categories_flagged(self):
        schema = self._schema()
        for step in ('K3C2-0', 'K3C7-0', '3D-0'):
            self.assertTrue(schema[step]['notCalculated'], step)

    def test_notes_name_the_item_and_merge_its_groups(self):
        # The ISO report listed "Not calculated — EQ-3B-22#2 … EQ-3B-22#20",
        # twenty lines with internal codes, for one locomotive type.
        from .step_entries import uncalculated_notes
        amounts = {'EQ-3B-22': '8000 litre', **{f'EQ-3B-22#{g}': '8000 litre' for g in range(2, 21)}}
        answers = {'3B-0': 'yes', '3B-7': amounts,
                   '3B-5': {k: 'diesel' for k in amounts}, '3B-6': {k: 'fuel_litres' for k in amounts}}
        notes = [n for n in uncalculated_notes(answers, 2025, self.company) if n['step_id'] == '3B-7']
        self.assertEqual(len(notes), 1, notes)
        self.assertTrue(notes[0]['en'].startswith('Diesel locomotive: no emission factor'), notes[0]['en'])
        self.assertTrue(notes[0]['en'].endswith('(20 groups)'))
        self.assertNotIn('EQ-3B', notes[0]['en'] + notes[0]['tr'])

    def test_a_locomotive_amount_is_answered_with_a_not_calculated_note(self):
        self._step('3B-0', 'yes')
        self._step('3B-1', ['EQ-3B-22'])
        self._step('3B-5', {'EQ-3B-22': 'diesel'})
        self._step('3B-6', {'EQ-3B-22': 'fuel_litres'})
        notes = self._step('3B-7', {'EQ-3B-22': '8000 litre'}).data['calc_feedback']['notes']
        self.assertTrue(any('no emission factor for this vehicle type' in n for n in notes), notes)
        self.assertEqual(self._entries(), [])
