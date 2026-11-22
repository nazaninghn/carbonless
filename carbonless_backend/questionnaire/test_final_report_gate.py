"""The final-report gate: a signed inventory is final, so direct and energy-indirect emissions that hold an amount
the inventory does not calculate must each be justified in writing by the signatory before the signature is
accepted. The justifications are stored with the signature and printed in the report.

* nothing to justify: the signature works as before;
* an uncalculated Scope 1 / Scope 2 amount without a justification: refused (400, `uncalculated_required`),
  nothing written;
* a justification that is too short or too long: refused at the serializer, bilingual;
* with a justification for every such question: signed, and the record is kept with the signature;
* an uncalculated Scope 3 amount is disclosed by the report but does not hold the signature back.
"""
from .models import CarbonReport, ReportStep
from .step_entries import signed_exclusions, unmet_required_calculations
from .test_signoff_lifecycle import SIGN, _Base, _dump

WHY = 'The LPG is bought in cylinders and invoiced by weight only; the supplier gives no volume.'


class FinalReportGateTests(_Base):
    def _with_gap(self, year=2021):
        """A complete route whose stationary fuel holds LPG in kg — never calculated (the factor is per litre)."""
        report = self._ready(year)
        for step, answer in (('3A-0', 'yes'), ('3A-5', {'lpg': '500 kg'})):
            ReportStep.objects.update_or_create(report=report, step_id=step, defaults={'answer': {'answer': answer}})
        return report

    def _answers(self, report):
        return dict(ReportStep.objects.filter(report=report).values_list('step_id', 'answer'))

    def _unmet(self, report):
        return unmet_required_calculations(self._answers(report), report.reporting_year, report.company, report)

    def test_an_inventory_with_nothing_uncalculated_signs_as_before(self):
        report = self._ready()
        self.assertEqual(self._unmet(report), [])
        r = self._sign(report)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(signed_exclusions(self._answers(report)), [])
        self.assertNotIn('exclusions', ReportStep.objects.get(report=report, step_id='7C-2').answer['answer'])

    def test_the_gap_is_found_on_the_scope_1_question(self):
        unmet = self._unmet(self._with_gap())
        self.assertEqual([u['step_id'] for u in unmet], ['3A-5'])
        self.assertIn('LPG', unmet[0]['items_en'][0])
        self.assertTrue(unmet[0]['items_tr'][0])
        self.assertTrue(unmet[0]['label_tr'].startswith('Soru ') and unmet[0]['label_en'].startswith('Question '))

    def test_signing_without_a_justification_is_refused_and_writes_nothing(self):
        report = self._with_gap()
        before = _dump(report)
        r = self._sign(report)
        self.assertEqual(r.status_code, 400, r.content)
        self.assertEqual(r.data['code'], 'uncalculated_required')
        self.assertEqual(r.data['missing'], ['3A-5'])
        self.assertEqual([u['step_id'] for u in r.data['unmet_calculations']], ['3A-5'])
        self.assertIn('cannot be signed yet', r.data['error_en'])
        self.assertIn('henüz imzalanamaz', r.data['error_tr'])
        self._assert_unsigned(report, before)

    def test_a_justification_out_of_bounds_is_refused_at_the_serializer_in_both_languages(self):
        report = self._with_gap()
        before = _dump(report)
        for text, tr, en in (('too short', 'en az 20 karakter', 'at least 20 characters'),
                             ('x' * 1001, 'en fazla 1000 karakter', 'at most 1000 characters'),
                             ('   ', 'boş bırakılamaz', 'cannot be empty')):
            r = self._step(report, '7C-2', {'answer': SIGN, 'exclusions': {'3A-5': text}})
            self.assertEqual((r.status_code, r.data['code']), (400, 'uncalculated_required'), text[:12])
            self.assertIn(tr, r.data['error_tr'])
            self.assertIn(en, r.data['error_en'])
            self._assert_unsigned(report, before)
        r = self._step(report, '7C-2', {'answer': SIGN, 'exclusions': 'because'})
        self.assertEqual(r.status_code, 400, r.content)
        self._assert_unsigned(report, before)

    def test_with_a_justification_it_signs_and_the_record_is_kept_with_the_signature(self):
        report = self._with_gap()
        r = self._step(report, '7C-2', {'answer': SIGN, 'exclusions': {'3A-5': f'  {WHY}  ', 'K3C4-2': 'x' * 30}})
        self.assertEqual(r.status_code, 200, r.content)
        report.refresh_from_db()
        self.assertEqual(report.status, CarbonReport.Status.COMPLETED)
        self.assertIsNotNone(report.signed_at)
        stored = ReportStep.objects.get(report=report, step_id='7C-2').answer
        self.assertNotIn('exclusions', stored)                              # kept inside the signed answer only
        kept = signed_exclusions(self._answers(report))
        self.assertEqual([(k['step_id'], k['justification']) for k in kept], [('3A-5', WHY)])   # only what was unmet
        self.assertIn('LPG', kept[0]['items_en'][0])
        self.assertTrue(kept[0]['items_tr'][0])
        self.assertEqual(stored['answer']['signatory_name'], SIGN['signatory_name'])

    def test_a_scope_3_amount_without_a_factor_does_not_hold_the_signature_back(self):
        report = self._ready()
        with_note = [u for u in self._unmet(report)]
        self.assertEqual(with_note, [])
        from . import step_entries
        from unittest import mock
        scope3 = [{'step_id': 'K3C4-2', 'tr': 'x — hesaplanmadı', 'en': 'x — not calculated', 'kind': 'not_calculated'}]
        with mock.patch.object(step_entries, 'uncalculated_notes', return_value=scope3):
            self.assertEqual(self._unmet(report), [])
            self.assertEqual(self._sign(report).status_code, 200)

    def test_a_scope_marked_absent_or_a_method_note_is_not_a_gap(self):
        report = self._ready()
        from . import step_entries
        from unittest import mock
        notes = [{'step_id': '3A-5', 'tr': 'a', 'en': 'a', 'kind': 'gate_closed'},
                 {'step_id': '4A-1', 'tr': 'b', 'en': 'b', 'kind': 'method'}]
        with mock.patch.object(step_entries, 'uncalculated_notes', return_value=notes):
            self.assertEqual(self._unmet(report), [])


class ReportStatesTheGapTests(FinalReportGateTests):
    """What the ISO report says about conformity follows what the inventory can carry."""

    def _text(self, report, lang):
        import io
        from pypdf import PdfReader
        from .iso_report_pdf import generate_iso_report
        pdf = generate_iso_report(CarbonReport.objects.get(pk=report.pk), lang=lang)
        return ' '.join(' '.join((page.extract_text() or '').split()) for page in PdfReader(io.BytesIO(pdf)).pages)

    def test_nothing_uncalculated_keeps_the_plain_statement(self):
        report = self._ready()
        self.assertEqual(self._sign(report).status_code, 200)
        en = self._text(report, 'en')
        self.assertIn('have been carried out in accordance with ISO 14064-1:2018, and the report follows', en)
        self.assertNotIn('not quantified', en)

    def test_an_unsigned_inventory_with_a_gap_does_not_claim_conformity(self):
        report = self._with_gap()
        en, tr = self._text(report, 'en'), self._text(report, 'tr')
        self.assertIn('Conformity with ISO 14064-1:2018 is not claimed', en)
        self.assertIn('No justification is recorded for them', en)
        self.assertIn('LPG', en)
        self.assertIn('uygunluk beyan etmemektedir', tr)
        self.assertIn('gerekçe kaydedilmemiştir', tr)
        self.assertNotIn('have been carried out in accordance with ISO 14064-1:2018, and the report follows', en)

    def test_a_signed_inventory_prints_the_exclusion_with_its_justification(self):
        report = self._with_gap()
        r = self._step(report, '7C-2', {'answer': SIGN, 'exclusions': {'3A-5': WHY}})
        self.assertEqual(r.status_code, 200, r.content)
        en, tr = self._text(report, 'en'), self._text(report, 'tr')
        self.assertIn('with the exception of the sources of direct and energy-indirect emissions that are not quantified', en)
        self.assertIn('Justification:', en)
        self.assertIn('invoiced by weight only', en)
        self.assertIn('Gerekçe:', tr)
        self.assertIn('invoiced by weight only', tr)                       # the signatory's own words, as written
        self.assertNotIn('is not claimed', en)
