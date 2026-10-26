"""Unit audit, Phase A: every unit the questionnaire offers for a fuel or purchased-energy amount either
reaches a calculation or says, right where it was entered, why it did not -- and a unit that does not belong
to the selected fuel / energy type is refused instead of being dropped from the inventory.

Nothing here changes a factor, a formula, a unit conversion or a stored answer."""
from decimal import Decimal as D

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase

from emissions.models import EmissionEntry
from . import tests as _base
from .carboniq_validation import _load_schema, validate_generic_step
from .models import ReportStep
from .step_entries import uncalculated_notes


def _offered(step):
    """[(item, unit)] exactly as the questionnaire's picker offers them (schema = frontend's questions.js)."""
    units = _load_schema()[step]['units']
    return [(item, unit) for item, offered in units.items() for unit in offered]


class _Base(TestCase):
    def setUp(self):
        cache.clear()                       # these tests save many steps: keep the request throttle from carrying over
        self.addCleanup(cache.clear)
        _base.StepEntriesTests.setUp(self)
        call_command('seed_factors', verbosity=0)

    def _patch(self, step, answer, lang='en'):
        return self.client.patch(f'/api/questionnaire/{self.report.id}/step/', {
            'step': step, 'data': {'answer': answer}, 'language': lang}, format='json')

    def _save(self, step, answer, lang='en'):
        r = self._patch(step, answer, lang)
        self.assertEqual(r.status_code, 200, r.content)
        return r

    def _step_entries(self, step):
        return list(EmissionEntry.objects.filter(company=self.company, description__startswith=f'Questionnaire step {step}'))

    def _notes(self, step):
        answers = dict(ReportStep.objects.filter(report=self.report).values_list('step_id', 'answer'))
        # Biomass is explained on the biomass-type question that follows 3A-5 (3A-5bio).
        steps = {step, '3A-5bio'} if step == '3A-5' else {step}
        return [n for n in uncalculated_notes(answers, 2025, self.company) if n['step_id'] in steps]


class UnitValidationPerItemTests(_Base):
    """The server checks the unit against the unit list of the selected item, not the union of all of them."""

    def _valid(self, step, answer):
        return validate_generic_step(step, {'answer': answer})

    def test_every_offered_unit_is_valid_for_its_own_item(self):
        for step in ('3A-5', '4B-2'):
            for item, unit in _offered(step):
                ok, err = self._valid(step, {item: f'100 {unit}'})
                self.assertTrue(ok, (step, item, unit, err))

    def test_a_unit_offered_only_for_another_item_is_refused(self):
        offered = {step: set(_offered(step)) for step in ('3A-5', '4B-2')}
        for step, pairs in offered.items():
            items = {i for i, _ in pairs}
            all_units = {u for _, u in pairs}
            for item in items:
                for unit in all_units:
                    if (item, unit) in pairs:
                        continue
                    ok, err = self._valid(step, {item: f'100 {unit}'})
                    self.assertFalse(ok, f'{step}: {item} + {unit} must be refused')
                    self.assertIn(item, err)

    def test_diesel_kg_is_rejected_with_a_clear_bilingual_message(self):
        r = self._patch('3A-5', {'diesel': '100 kg'})
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("'kg'", r.data['error'])
        self.assertIn('diesel', r.data['error'])
        self.assertIn('litre', r.data['error'])
        self.assertFalse(ReportStep.objects.filter(report=self.report, step_id='3A-5').exists())
        r = self._patch('3A-5', {'diesel': '100 kg'}, lang='tr')
        self.assertEqual(r.status_code, 400)
        self.assertIn('birimi geçerli değil', r.data['error'])

    def test_compressed_air_in_tonnes_and_heat_in_m3_are_rejected(self):
        self.assertEqual(self._patch('4B-2', {'compressed_air': '5 tonnes'}).status_code, 400)
        self.assertEqual(self._patch('4B-2', {'heat': '5 m³'}).status_code, 400)
        self.assertEqual(self._patch('3A-5', {'natural_gas': '5 litre'}).status_code, 400)

    def test_grouped_item_keys_use_the_base_item(self):
        self.assertTrue(self._valid('3A-5', {'diesel#2': '10 litre'})[0])
        self.assertFalse(self._valid('3A-5', {'diesel#2': '10 kg'})[0])

    def test_unknown_item_keeps_the_previous_behaviour(self):
        # No unit list for the key: unchanged (any offered unit), never a new 500.
        self.assertTrue(self._valid('3A-5', {'mystery': '5 kg'})[0])

    def test_bare_number_and_chip_only_values_are_still_accepted(self):
        self.assertTrue(self._valid('3A-5', {'diesel': '100'})[0])
        self.assertTrue(self._valid('3A-5', {'diesel': ' litre'})[0])


class MultiWordUnitTests(_Base):
    """3A-3's 'kg buhar/h' has a space: the amount is the part before it, not 'N kg'."""

    def test_capacity_in_every_offered_unit_validates(self):
        for unit in _load_schema()['3A-3']['units']:
            ok, err = validate_generic_step('3A-3', {'answer': {'EQ-3A-01': f'500 {unit}'}})
            self.assertTrue(ok, (unit, err))

    def test_garbage_amount_or_unknown_unit_is_still_refused(self):
        self.assertFalse(validate_generic_step('3A-3', {'answer': {'EQ-3A-01': 'abc kg buhar/h'}})[0])
        self.assertFalse(validate_generic_step('3A-3', {'answer': {'EQ-3A-01': '500 kg'}})[0])
        self.assertFalse(validate_generic_step('3A-3', {'answer': {'EQ-3A-01': '500 buhar/h'}})[0])
        self.assertFalse(validate_generic_step('3A-3', {'answer': {'EQ-3A-01': '-5 kg buhar/h'}})[0])

    def test_capacity_is_stored_verbatim_and_adds_no_emissions(self):
        self._save('3A-3', {'EQ-3A-01': '500 kg buhar/h'})
        step = ReportStep.objects.get(report=self.report, step_id='3A-3')
        self.assertEqual(step.answer['answer'] if 'answer' in step.answer else step.answer, {'EQ-3A-01': '500 kg buhar/h'})
        self.assertEqual(self._step_entries('3A-3'), [])


class OfferedUnitIsCalculatedOrExplainedTests(_Base):
    """Parity: for every (fuel / energy type, unit) the picker offers, saving 100 of it either creates an
    emission entry or leaves a not-calculated note on that step. A silent drop fails here."""

    def _check(self, step, item, unit):
        # A step's answer replaces the previous one, so each call starts from a clean step.
        self._save(step, {item: f'100 {unit}'})
        return len(self._step_entries(step)), self._notes(step)

    def test_every_offered_3a5_unit(self):
        silent = []
        for fuel, unit in _offered('3A-5'):
            made, notes = self._check('3A-5', fuel, unit)
            if not made and not notes:
                silent.append((fuel, unit))
        self.assertEqual(silent, [], f'offered but neither calculated nor explained: {silent}')

    def test_every_offered_4b2_unit(self):
        silent = []
        for kind, unit in _offered('4B-2'):
            made, notes = self._check('4B-2', kind, unit)
            if not made and not notes:
                silent.append((kind, unit))
        self.assertEqual(silent, [], f'offered but neither calculated nor explained: {silent}')

    def test_calculated_units_really_calculate(self):
        for fuel, unit in (('natural_gas', 'm³'), ('natural_gas', 'kWh'), ('fuel_oil', 'litre'), ('diesel', 'litre'),
                           ('lpg', 'litre'), ('coal', 'ton'), ('coal', 'kg')):
            made, notes = self._check('3A-5', fuel, unit)
            self.assertEqual(made, 1, (fuel, unit))
            self.assertEqual(notes, [], (fuel, unit))
        for kind, unit in (('heat', 'GJ'), ('heat', 'MWh'), ('steam', 'GJ'), ('cooling', 'MWh')):
            made, notes = self._check('4B-2', kind, unit)
            self.assertEqual(made, 1, (kind, unit))
            self.assertEqual(notes, [], (kind, unit))


class LpgFuelOilKgTests(_Base):
    """kg stays offered for LPG and fuel oil in Phase A. The registered factors are per litre and no density
    conversion exists, so a kg amount is kept exactly as entered and is told apart from a calculated one."""

    def test_kg_is_kept_verbatim_not_calculated_and_explained_in_both_languages(self):
        for fuel in ('lpg', 'fuel_oil'):
            r = self._save('3A-5', {fuel: '500 kg'})
            self.assertEqual(self._step_entries('3A-5'), [], fuel)
            stored = ReportStep.objects.get(report=self.report, step_id='3A-5').answer
            stored = stored['answer'] if 'answer' in stored else stored
            self.assertEqual(stored, {fuel: '500 kg'})                        # value untouched
            en = [n for n in r.data['calc_feedback']['notes'] if 'kg' in n]
            self.assertEqual(len(en), 1, (fuel, r.data['calc_feedback']['notes']))
            self.assertIn('not calculated', en[0])
            self.assertIn('no density conversion', en[0])
            self.assertIn('litre', en[0])
            tr = self._save('3A-5', {fuel: '500 kg'}, lang='tr').data['calc_feedback']['notes']
            tr = [n for n in tr if 'kg' in n]
            self.assertEqual(len(tr), 1)
            self.assertIn('hesaplanmadı', tr[0])
            self.assertIn('yoğunluk', tr[0])

    def test_kg_does_not_change_the_calculated_total(self):
        self._save('3A-5', {'natural_gas': '10000 m³'})
        base = sum(e.calculated_co2e_kg for e in self._step_entries('3A-5'))
        self.assertEqual(base, D('20200.0000'))                              # standing regression guard
        self._save('3A-5', {'natural_gas': '10000 m³', 'lpg': '500 kg', 'fuel_oil': '700 kg'})
        self.assertEqual(sum(e.calculated_co2e_kg for e in self._step_entries('3A-5')), base)

    def test_answers_saved_before_this_change_are_surfaced_without_resaving(self):
        # What an older save (or an API payload) left behind: kg for LPG / fuel oil, and a unit that never
        # belonged to the fuel (diesel in kg). No re-save happens: the notes come from the stored answers.
        ReportStep.objects.create(report=self.report, step_id='3A-5',
                                  answer={'answer': {'lpg': '500 kg', 'fuel_oil': '700 kg', 'diesel': '90 kg'}})
        notes = self._notes('3A-5')
        text = ' | '.join(n['en'] for n in notes)
        for fuel in ('LPG', 'Fuel oil', 'Diesel'):
            self.assertIn(fuel, text)
        self.assertEqual(len(notes), 3, notes)
        self.assertTrue(all(n['tr'] and n['en'] and n['kind'] == 'not_calculated' for n in notes))

    def test_a_bare_number_has_no_unit_and_is_said_so(self):
        r = self._save('3A-5', {'lpg': '500'})
        self.assertEqual(self._step_entries('3A-5'), [])
        notes = r.data['calc_feedback']['notes']
        self.assertEqual(len(notes), 1, notes)
        self.assertIn('no unit', notes[0])


class CompressedAirTests(_Base):
    def test_compressed_air_is_explained_for_every_offered_unit_and_not_told_to_use_gj_or_mwh(self):
        for unit in ('GJ', 'm³'):
            r = self._save('4B-2', {'compressed_air': f'100 {unit}'})
            self.assertEqual(self._step_entries('4B-2'), [])
            notes = r.data['calc_feedback']['notes']
            self.assertEqual(len(notes), 1, (unit, notes))
            self.assertIn('Compressed air', notes[0])
            self.assertNotIn('enter GJ or MWh', notes[0])
            tr = self._save('4B-2', {'compressed_air': f'100 {unit}'}, lang='tr').data['calc_feedback']['notes']
            self.assertIn('Basınçlı hava', tr[0])
            self.assertNotIn('GJ veya MWh girin', tr[0])

    def test_steam_in_tonnes_still_points_to_gj_or_mwh(self):
        r = self._save('4B-2', {'steam': '100 tonnes'})
        self.assertEqual(self._step_entries('4B-2'), [])
        self.assertIn('enter GJ or MWh', r.data['calc_feedback']['notes'][0])

    def test_stored_value_is_unchanged(self):
        self._save('4B-2', {'compressed_air': '100 m³'})
        stored = ReportStep.objects.get(report=self.report, step_id='4B-2').answer
        stored = stored['answer'] if 'answer' in stored else stored
        self.assertEqual(stored, {'compressed_air': '100 m³'})
