"""“I don't know — answer later” (CarbonReport.pending_questions).

A pending question is unanswered on purpose: it creates no ReportStep and no emission entry, so
progress, the completion gate, the reports and every calculation keep seeing it as missing — never as
an empty answer or a zero. Saving a valid answer clears the mark. Uses the representative inventory
(test_stage3_oracle.py): its figures are the proof that nothing moved."""
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from companies.models import Company, CompanyMembership
from .models import CarbonReport, ReportStep
from .test_stage3_scenarios import _Inventory, TOTAL

PENDING = '4A-EF'          # unanswered in the representative inventory; answering 'yes' is valid


class PendingQuestionTests(_Inventory):

    def _url(self, report=None):
        return f'/api/questionnaire/{(report or self.report).id}/pending/'

    def _mark(self, step=PENDING, pending=True, lang='en', client=None):
        return (client or self.client).post(self._url(), {'step': step, 'pending': pending, 'language': lang}, format='json')

    def _status(self, client=None):
        r = (client or self.client).get(f'/api/questionnaire/{self.report.id}/')
        self.assertEqual(r.status_code, 200, r.content)
        return r.data

    def _snapshot(self):
        return (dict(ReportStep.objects.filter(report=self.report).values_list('step_id', 'answer')),
                sorted((e.pk, str(e.calculated_co2e_kg)) for e in self._entries()))

    # 2 + 5 — marking a question changes no answer, no entry, no figure, and is never a zero
    def test_marking_a_question_pending_saves_no_answer_and_changes_no_figure(self):
        before = self._snapshot()
        progress = self._status()['progress']
        r = self._mark()
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data['pending_questions'], [PENDING])
        self.assertEqual(self._snapshot(), before)                       # other answers + entries identical
        self.assertFalse(ReportStep.objects.filter(report=self.report, step_id=PENDING).exists())
        self.assertAlmostEqual(self._summary()['total_kg'], TOTAL, places=2)
        s = self._status()
        self.assertEqual(s['pending_questions'], [PENDING])
        self.assertNotIn(PENDING, s['answers'])                          # not an empty answer
        self.assertNotIn(PENDING, s['completed_steps'])                  # not counted as done
        self.assertEqual(s['progress'], progress)

    # 3 — it survives a refresh, a new session and re-listing
    def test_pending_status_survives_a_new_session(self):
        self._mark()
        fresh = APIClient()
        fresh.force_authenticate(user=self.user)
        self.assertEqual(self._status(fresh)['pending_questions'], [PENDING])

    def test_marking_twice_lists_it_once_and_several_questions_are_kept(self):
        self._mark()
        self._mark()
        self._mark('4B-EF')
        self.assertEqual(self._status()['pending_questions'], [PENDING, '4B-EF'])

    # 4 + 7 — answering the exact question clears it; the rest stay
    def test_a_valid_answer_clears_only_that_question(self):
        self._mark()
        self._mark('4B-EF')
        self._step(PENDING, 'yes')
        s = self._status()
        self.assertEqual(s['pending_questions'], ['4B-EF'])
        self.assertIn(PENDING, s['answers'])
        self.assertAlmostEqual(self._summary()['total_kg'], TOTAL, places=2)

    def test_an_invalid_answer_keeps_the_question_pending(self):
        self._mark()
        r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/', {
            'step': PENDING, 'data': {'answer': {'not': 'valid'}}}, format='json')
        self.assertGreaterEqual(r.status_code, 400)
        self.assertEqual(self._status()['pending_questions'], [PENDING])
        self.assertFalse(ReportStep.objects.filter(report=self.report, step_id=PENDING).exists())

    def test_unmarking_removes_it_without_an_answer(self):
        self._mark()
        r = self._mark(pending=False)
        self.assertEqual(r.data['pending_questions'], [])
        self.assertEqual(self._status()['pending_questions'], [])
        self.assertFalse(ReportStep.objects.filter(report=self.report, step_id=PENDING).exists())

    # 5 — an existing answer is never replaced by "I don't know"
    def test_an_answered_question_cannot_be_marked_and_keeps_its_answer(self):
        saved = ReportStep.objects.get(report=self.report, step_id='3A-5').answer
        r = self._mark('3A-5')
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.data['code'], 'already_answered')
        self.assertEqual(ReportStep.objects.get(report=self.report, step_id='3A-5').answer, saved)
        self.assertEqual(self._status()['pending_questions'], [])

    # 6 — completion is blocked while a question is pending; figures stay correct
    def test_the_inventory_cannot_be_completed_with_a_pending_question(self):
        self._mark()
        r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/', {
            'step': '7B-INFO', 'data': {'answer': 'done'}}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data['code'], 'pending_questions')
        self.assertEqual(r.data['pending_questions'], [PENDING])
        self.report.refresh_from_db()
        self.assertNotEqual(self.report.status, CarbonReport.Status.COMPLETED)
        self.assertAlmostEqual(self._summary()['total_kg'], TOTAL, places=2)

    def test_once_resolved_the_pending_gate_no_longer_blocks_completion(self):
        self._mark()
        self._step(PENDING, 'yes')
        r = self.client.patch(f'/api/questionnaire/{self.report.id}/step/', {
            'step': '7B-INFO', 'data': {'answer': 'done'}}, format='json')
        self.assertNotEqual(r.data.get('code'), 'pending_questions')

    # language follows the request (existing en/tr convention)
    def test_messages_follow_the_selected_language(self):
        self._mark()
        done = {'step': '7B-INFO', 'data': {'answer': 'done'}}
        en = self.client.patch(f'/api/questionnaire/{self.report.id}/step/', {**done, 'language': 'en'}, format='json')
        tr = self.client.patch(f'/api/questionnaire/{self.report.id}/step/', {**done, 'language': 'tr'}, format='json')
        self.assertIn('answer later', en.data['error'])
        self.assertNotIn('sonra', en.data['error'])
        self.assertIn('sonra yanıtla', tr.data['error'])
        self.assertNotIn('answer later', tr.data['error'])
        self.assertIn('already answered', self._mark('3A-5', lang='en').data['error'])
        self.assertIn('zaten yanıtlandı', self._mark('3A-5', lang='tr').data['error'])
        self.assertIn('not a recognised', self._mark('ZZ-999', lang='en').data['error'])
        self.assertIn('tanınan', self._mark('ZZ-999', lang='tr').data['error'])

    # input checks
    def test_unknown_or_malformed_requests_are_refused_without_side_effects(self):
        self.assertEqual(self._mark('ZZ-999').status_code, 400)
        for body in ({}, {'step': ''}, {'step': PENDING, 'pending': 'yes'}, {'step': 7}):
            self.assertEqual(self.client.post(self._url(), body, format='json').status_code, 400, body)
        self.assertEqual(self._status()['pending_questions'], [])

    # rules shared with saving an answer
    def test_a_completed_inventory_cannot_take_a_pending_question(self):
        CarbonReport.objects.filter(pk=self.report.pk).update(status=CarbonReport.Status.COMPLETED)
        self.assertEqual(self._mark().status_code, 409)
        self.assertEqual(self._status()['pending_questions'], [])

    def test_a_year_shared_with_another_inventory_is_refused(self):
        CarbonReport.objects.filter(pk=self.report.pk).update(legacy_duplicate_year=True)
        CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=self.report.reporting_year,
                                    title='Second', legacy_duplicate_year=True)
        self.assertEqual(self._mark().status_code, 409)

    def test_only_members_of_the_company_can_use_it(self):
        outsider = User.objects.create_user('pq_out', 'pq_out@test.com', 'pass12345')
        other = Company.objects.create(
            legal_entity_name='Other Co', tax_number='77', country_of_headquarters='TR', countries_of_operation='TR',
            nace_code='', main_activity_description='x', number_of_employees='1-10', annual_turnover_range='x',
            number_of_facilities=1)
        CompanyMembership.objects.create(user=outsider, company=other, role='owner')
        c = APIClient()
        c.force_authenticate(user=outsider)
        self.assertEqual(self._mark(client=c).status_code, 404)
        self.assertEqual(self._status()['pending_questions'], [])

    def test_an_auditor_cannot_change_it(self):
        auditor = User.objects.create_user('pq_aud', 'pq_aud@test.com', 'pass12345')
        CompanyMembership.objects.create(user=auditor, company=self.company, role='auditor')
        c = APIClient()
        c.force_authenticate(user=auditor)
        self.assertEqual(self._mark(client=c).status_code, 403)
        self.assertEqual(self._status()['pending_questions'], [])

    def test_a_report_saved_without_the_column_value_reads_as_none_pending(self):
        CarbonReport.objects.filter(pk=self.report.pk).update(pending_questions=None)
        self.assertEqual(self._status()['pending_questions'], [])
        self.assertEqual(self._mark().data['pending_questions'], [PENDING])
