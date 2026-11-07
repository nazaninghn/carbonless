"""The sign-off lifecycle: the signature (7C-2) validates, signs, completes and locks the inventory, in one transaction.

Before this, the signature was saved without any check and locked the inventory at once, and completion lived in
7B-INFO behind it, which the lock then refused: a signed inventory stayed in progress for ever. Now:

* the checks of completion run on the signature, under the write lock, BEFORE anything is written;
* signed and completed are one all-or-nothing write;
* nothing after it is saved: 7A-INFO, 7B-INFO and the assumptions review are refused like every other step;
* inventories already signed or already completed are left exactly as they are.
"""
from unittest import mock

from django.contrib.auth.models import User

from companies.models import CompanyMembership
from emissions.models import EmissionEntry
from . import deferral
from . import test_deferral_edge_cases as edge
from .models import CarbonReport, ReportField, ReportStep

SIGN = {'signatory_name': 'Ayşe Demir', 'signatory_title': 'Sürdürülebilirlik Müdürü', 'declaration_accepted': 'accepted'}
AFTER_SIGNING = ('7C-2', '7A-INFO', '7B-INFO')


def _dump(report):
    """Everything a save could touch on this inventory."""
    return {
        'report': CarbonReport.objects.filter(pk=report.pk).values().first(),
        'steps': sorted(ReportStep.objects.filter(report=report).values_list('step_id', 'answer', 'completed_at'), key=str),
        'fields': sorted(ReportField.objects.filter(report=report).values_list('field_id', 'value'), key=str),
        'entries': sorted(EmissionEntry.objects.filter(inventory=report).values_list('id', 'calculated_co2e_kg', 'quantity', 'status'), key=str),
    }


class _Base(edge._Base):
    def _ready(self, year=2021, **kw):
        """A real route of the questionnaire, answered up to the signature."""
        s = next(x for x in edge._complete_scenarios() if x['answers'].get('7C-1') == 'all_complete')
        answers = {k: v for k, v in s['answers'].items() if k not in AFTER_SIGNING}
        return self._report(answers, year, **kw)

    def _sign(self, report, data=None):
        return self._step(report, '7C-2', {'answer': data or SIGN})

    def _assert_unsigned(self, report, before):
        self.assertEqual(_dump(report), before)                     # nothing at all was written
        self.assertIsNone(CarbonReport.objects.get(pk=report.pk).signed_at)


class TheSignatureCompletesTests(_Base):
    def test_it_signs_and_completes_in_one_step(self):
        report = self._ready()
        r = self._sign(report)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertIs(r.data['completed'], True)
        self.assertIsNone(r.data['next_step'])
        self.assertTrue(r.data['signed_at'])
        report.refresh_from_db()
        self.assertEqual(report.status, CarbonReport.Status.COMPLETED)
        self.assertEqual(report.current_step, 'DONE')
        self.assertIsNotNone(report.signed_at)
        saved = ReportStep.objects.get(report=report, step_id='7C-2').answer['answer']
        self.assertEqual(saved['signatory_name'], SIGN['signatory_name'])
        self.assertTrue(saved['confirmed_by'])

    def test_the_completion_is_on_the_company_activity_log_once(self):
        report = self._ready()
        with mock.patch('emissions.audit.log_company_activity') as log:
            self.assertEqual(self._sign(report).status_code, 200)
        self.assertEqual(log.call_count, 1)
        self.assertEqual(log.call_args.args[2], 'inventory_completed')

    def test_status_says_signed_and_finished(self):
        report = self._ready()
        self._sign(report)
        s = self._status(report)
        self.assertTrue(s['signed_at'])
        self.assertEqual(s['status'], CarbonReport.Status.COMPLETED)
        self.assertEqual(s['progress']['percent'], 100)

    def test_the_pdfs_of_a_signed_inventory_are_final_not_drafts(self):
        report = self._ready()
        self._sign(report)
        with mock.patch('questionnaire.report_pdf.generate_questionnaire_report', return_value=b'%PDF-1.4') as gen:
            pdf = self.client.get(f'/api/questionnaire/{report.id}/pdf/')
        self.assertEqual(pdf.status_code, 200)
        self.assertIs(gen.call_args.kwargs['draft'], False)

    def test_signing_changes_no_calculated_figure(self):
        report = self._ready()
        before = sorted(EmissionEntry.objects.filter(inventory=report).values_list('id', 'calculated_co2e_kg', 'quantity', 'status'), key=str)
        self._sign(report)
        self.assertEqual(sorted(EmissionEntry.objects.filter(inventory=report).values_list('id', 'calculated_co2e_kg', 'quantity', 'status'), key=str), before)

    def test_a_failure_after_the_signature_leaves_it_unsigned_and_unfinished(self):
        report = self._ready()
        before = _dump(report)
        self.client.raise_request_exception = False
        with mock.patch('emissions.audit.log_company_activity', side_effect=RuntimeError('boom')):
            r = self._sign(report)
        self.assertEqual(r.status_code, 500)
        self._assert_unsigned(report, before)


class AnIncompleteInventoryCannotBeSignedTests(_Base):
    def test_a_question_left_for_later_refuses_it_and_says_which(self):
        report = self._ready(pending=['A2'])
        ReportStep.objects.filter(report=report, step_id='A2').delete()
        before = _dump(report)
        r = self._sign(report)
        self.assertEqual((r.status_code, r.data['code']), (400, 'pending_questions'))
        self.assertEqual(r.data['first_question'], 'A2')
        self.assertTrue(r.data['error_en'] and r.data['error_tr'])
        self._assert_unsigned(report, before)

    def test_a_required_question_without_an_answer_refuses_it_and_says_which(self):
        report = self._ready()
        ReportStep.objects.filter(report=report, step_id='2A-1').delete()
        before = _dump(report)
        r = self._sign(report)
        self.assertEqual((r.status_code, r.data['code']), (400, 'required_unanswered'))
        self.assertEqual(r.data['first_question'], '2A-1')
        self.assertIn('2A-1', r.data['required_unanswered'])
        self._assert_unsigned(report, before)

    def test_what_lies_after_the_signature_is_not_asked_for(self):
        report = self._ready()
        self.assertEqual(deferral.required_before_signature(deferral.saved_answers(report)), [])
        self.assertIn('7B-INFO', deferral.required_unanswered(deferral.saved_answers(report)))

    def test_the_answer_something_is_missing_refuses_it(self):
        report = self._ready()
        ReportStep.objects.filter(report=report, step_id='7C-1').update(answer={'answer': 'fix_missing'})
        before = _dump(report)
        r = self._sign(report)
        self.assertEqual((r.status_code, r.data['code']), (400, 'required_unanswered'))
        self.assertEqual(r.data['first_question'], '7C-1')
        self._assert_unsigned(report, before)

    def test_an_empty_inventory_cannot_be_signed_by_calling_the_api(self):
        report = self._report({'A1': {'answer': 'x'}}, 2022)
        before = _dump(report)
        self.assertEqual(self._sign(report).status_code, 400)
        self._assert_unsigned(report, before)

    def test_a_bad_signature_is_refused_by_the_same_validation_as_before(self):
        report = self._ready()
        before = _dump(report)
        self.assertEqual(self._sign(report, {**SIGN, 'signatory_name': '123'}).status_code, 400)
        self._assert_unsigned(report, before)

    def test_a_data_entry_member_cannot_sign(self):
        report = self._ready()
        before = _dump(report)
        clerk = User.objects.create_user('clerk', 'clerk@test.com', 'pass12345')
        CompanyMembership.objects.create(user=clerk, company=self.company, role='data_entry')
        self.client.force_authenticate(user=clerk)
        r = self._sign(report)
        self.assertEqual((r.status_code, r.data['code']), (403, 'signature_role'))
        self._assert_unsigned(report, before)


class NothingAfterTheSignatureIsSavedTests(_Base):
    STEPS = [
        ('7A-INFO', {'answer': 'seen'}),
        ('7B-INFO', {'answer': 'done'}),
        ('7B-INFO', {'answer': 'view_assumptions'}),
        ('7C-1', {'answer': 'all_complete'}),
        ('7C-2', {'answer': SIGN}),
        ('6B-2', {'answer': 'overestimate'}),
        ('6B-5', {'answer': 'confirmed'}),
    ]

    def test_q127_q128_and_everything_else_are_refused_and_nothing_changes(self):
        report = self._ready()
        self._sign(report)
        before = _dump(report)
        for step, data in self.STEPS:
            with self.subTest(step=step, data=data):
                r = self._step(report, step, data)
                self.assertEqual((r.status_code, r.data.get('code')), (409, 'inventory_signed'), r.content)
        self.assertEqual(_dump(report), before)

    def test_the_answers_after_the_signature_do_not_exist(self):
        report = self._ready()
        self._sign(report)
        self.assertFalse(ReportStep.objects.filter(report=report, step_id__in=('7A-INFO', '7B-INFO')).exists())


class ExistingInventoriesAreLeftAloneTests(_Base):
    def _signed_in_progress(self):
        """The state the old lifecycle left behind: signed, but stuck in progress."""
        report = self._ready()
        ReportStep.objects.create(report=report, step_id='7C-2', answer={'answer': SIGN})
        from django.utils import timezone
        CarbonReport.objects.filter(pk=report.pk).update(signed_at=timezone.now())
        report.refresh_from_db()
        return report

    def test_one_stuck_signed_stays_exactly_as_it_is(self):
        report = self._signed_in_progress()
        before = _dump(report)
        for step, data in NothingAfterTheSignatureIsSavedTests.STEPS:
            self.assertEqual(self._step(report, step, data).status_code, 409)
        self.assertEqual(_dump(report), before)
        self.assertEqual(report.status, CarbonReport.Status.IN_PROGRESS)
        self.assertTrue(self._status(report)['signed_at'])                  # the screen can tell it is closed

    def test_a_completed_but_unsigned_one_can_still_be_signed(self):
        report = self._report({'A1': {'answer': 'x'}}, 2023, status=CarbonReport.Status.COMPLETED)
        r = self._sign(report)
        self.assertEqual(r.status_code, 200, r.content)
        report.refresh_from_db()
        self.assertIsNotNone(report.signed_at)
        self.assertEqual(report.status, CarbonReport.Status.COMPLETED)

    def test_the_old_completion_still_needs_the_signature_it_always_needed(self):
        report = self._ready()
        r = self._step(report, '7B-INFO', {'answer': 'done'})
        self.assertEqual((r.status_code, r.data['code']), (400, 'required_unanswered'))
        self.assertIn('7C-2', r.data['required_unanswered'])
        self.assertNotEqual(CarbonReport.objects.get(pk=report.pk).status, CarbonReport.Status.COMPLETED)
