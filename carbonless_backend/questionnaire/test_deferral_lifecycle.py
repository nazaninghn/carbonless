"""The answer-later policy across an inventory's life: a question that was deferred before it became required
(inventory #34 holds 2A-1), a new inventory (nothing inherited as an answer), and next year's start from the
earlier inventory (hints are read-only, a profile reuse copies saved answers only and keeps a deferred question
deferred — it never becomes an answer). Saved answers are never rewritten here.
"""
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from companies.models import Company, CompanyMembership
from . import deferral
from . import tests as _base
from .models import CarbonReport, ReportStep


def _rows(report):
    return sorted(ReportStep.objects.filter(report=report).values_list('step_id', 'answer', 'is_skipped'))


def _state(report):
    r = CarbonReport.objects.get(pk=report.pk)
    return (_rows(r), list(r.pending_questions or []), r.status, r.current_step, r.client_progress, r.reporting_year)


class _Base(_base.TestCase):
    def setUp(self):
        self.user = User.objects.create_user('lc_owner', 'lc_owner@test.com', 'pass12345')
        self.company = Company.objects.create(
            legal_entity_name='Lifecycle Co', tax_number='9990001112', country_of_headquarters='TR',
            countries_of_operation='TR', nace_code='', main_activity_description='x', number_of_employees='1-10',
            annual_turnover_range='x', number_of_facilities=1)
        CompanyMembership.objects.create(user=self.user, company=self.company, role='owner')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _step(self, report, step, data):
        return self.client.patch(f'/api/questionnaire/{report.id}/step/', {'step': step, 'data': data}, format='json')

    def _mark(self, report, step, pending=True):
        return self.client.post(f'/api/questionnaire/{report.id}/pending/', {'step': step, 'pending': pending}, format='json')

    def _status(self, report):
        r = self.client.get(f'/api/questionnaire/{report.id}/')
        self.assertEqual(r.status_code, 200, r.content)
        return r.data


class ExistingDeferredRequiredQuestionTests(_Base):
    """Inventory #34: 2A-1 (number of facilities) was deferred when that was still allowed; it is REQUIRED now."""

    def setUp(self):
        super().setUp()
        self.report = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025,
                                                  pending_questions=['2A-1'], client_progress={'answered': 8, 'total': 68})
        for step, answer in (('A1', {'legal_name': 'Lifecycle Co'}), ('A4', {'reporting_year': 2025})):
            ReportStep.objects.create(report=self.report, step_id=step, answer=answer)

    def test_it_stays_visible_as_unanswered_and_gets_no_fabricated_answer(self):
        before = _state(self.report)
        s = self._status(self.report)
        self.assertEqual(s['pending_questions'], ['2A-1'])
        self.assertNotIn('2A-1', s['answers'])
        self.assertFalse(ReportStep.objects.filter(report=self.report, step_id='2A-1').exists())
        self.assertEqual(_state(self.report), before)                       # reading it changed nothing

    def test_it_blocks_completion(self):
        r = self._step(self.report, '7B-INFO', {'answer': 'done'})
        self.assertEqual((r.status_code, r.data['code']), (400, 'pending_questions'))
        self.assertEqual(r.data['pending_questions'], ['2A-1'])
        self.assertNotEqual(CarbonReport.objects.get(pk=self.report.pk).status, CarbonReport.Status.COMPLETED)
        # even with the mark gone, the question is still required: it keeps blocking
        CarbonReport.objects.filter(pk=self.report.pk).update(pending_questions=[])
        r = self._step(self.report, '7B-INFO', {'answer': 'done'})
        self.assertEqual(r.data['code'], 'required_unanswered')
        self.assertIn('2A-1', r.data['required_unanswered'])

    def test_it_can_be_answered_normally_and_the_mark_clears(self):
        r = self._step(self.report, '2A-1', {'answer': '1'})
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(ReportStep.objects.filter(report=self.report, step_id='2A-1').exists())
        self.assertEqual(self._status(self.report)['pending_questions'], [])

    def test_it_cannot_be_deferred_again_but_the_old_mark_can_be_removed(self):
        r = self._mark(self.report, '2A-1')
        self.assertEqual((r.status_code, r.data['code'], r.data['reason']), (400, 'not_deferrable', 'loop_source'))
        self.assertEqual(self._status(self.report)['pending_questions'], ['2A-1'])      # the existing mark is untouched
        r = self._mark(self.report, '2A-1', pending=False)                              # the user may take the mark off
        self.assertEqual(r.status_code, 200)

    def test_no_saved_answer_or_progress_is_modified_by_any_of_it(self):
        self.report.refresh_from_db()
        before = _state(self.report)
        self._status(self.report)
        self._mark(self.report, '2A-1')                                                  # refused
        self._step(self.report, '7B-INFO', {'answer': 'done'})                           # refused (this attempt is recorded as its own step)
        after = _state(self.report)
        rows_before = [r for r in before[0]]
        rows_after = [r for r in after[0] if r[0] != '7B-INFO']
        self.assertEqual(rows_after, rows_before)                                        # every earlier answer identical
        self.assertEqual((after[1], after[4], after[5]), (before[1], before[4], before[5]))   # pending, progress, year


class NewInventoryTests(_Base):

    def _earlier(self):
        src = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2024,
                                          pending_questions=['A2', 'K3C7-4'], boundary_approach='operational_control')
        for step, answer in (('A1', {'legal_name': 'Lifecycle Co'}), ('A4', {'reporting_year': 2024}),
                             ('A7', {'has_previous_report': False}), ('B1', {'nace_code': 'C'}),
                             ('C1', {'has_subsidiaries': False}), ('D3', {'boundary_approach': 'operational_control'}),
                             ('SCOPE-GROUPING', {'answer': 'separate'}), ('3A-0', {'answer': 'yes'}),
                             ('3A-1', {'answer': ['EQ-3A-01']})):
            ReportStep.objects.create(report=src, step_id=step, answer=answer)
        return src

    def _start(self, year=2025):
        r = self.client.post('/api/questionnaire/start/', {'title': 'Next', 'reporting_year': year, 'force_new': True},
                             format='json')
        self.assertEqual(r.status_code, 201, r.content)
        return CarbonReport.objects.get(pk=r.data['report_id'])

    def test_a_new_inventory_has_the_policy_at_once_and_inherits_nothing_as_an_answer(self):
        src = self._earlier()
        before = _state(src)
        new = self._start()
        self.assertEqual(list(new.pending_questions or []), [])                           # no deferral inherited
        self.assertFalse(ReportStep.objects.filter(report=new, step_id__in=['A2', 'SCOPE-GROUPING', '3A-0', '3A-1', 'K3C7-4']).exists())
        # required / deferrable decisions hold from the first minute
        self.assertEqual(self._mark(new, 'SCOPE-GROUPING').data['code'], 'not_deferrable')
        self.assertEqual(self._mark(new, 'A2').status_code, 200)
        self.assertEqual(self._status(new)['pending_questions'], ['A2'])
        self.assertEqual(_state(src), before)                                              # the earlier inventory is untouched

    def test_last_years_structure_is_only_a_hint_never_saved(self):
        src = self._earlier()
        new = self._start()
        before_new = _state(new)
        r = self.client.get(f'/api/questionnaire/{new.id}/previous-profile/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['source_report_id'], src.id)
        self.assertIn('SCOPE-GROUPING', r.data['previous_structure'])                     # the existing rule: shown, to be re-confirmed
        self.assertIn('3A-0', r.data['previous_structure'])
        self.assertNotIn('K3C7-4', r.data['previous_structure'])                          # a deferred question has nothing to carry
        self.assertEqual(_state(new), before_new)                                          # a hint writes no answer

    def test_reusing_the_profile_copies_saved_answers_only_and_keeps_a_deferred_question_deferred(self):
        src = self._earlier()
        before_src = _state(src)
        new = self._start()
        r = self.client.post(f'/api/questionnaire/{new.id}/reuse-profile/', {'reporting_year': 2025}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        new.refresh_from_db()
        rows = dict((s, a) for s, a, _ in _rows(new))
        self.assertEqual(rows['B1'], {'nace_code': 'C'})                                   # a saved answer is copied
        self.assertEqual(rows['A4'], {'reporting_year': 2025})                             # but the year is its own
        self.assertNotIn('A2', rows)                                                       # the deferred one has NO answer
        self.assertNotIn('SCOPE-GROUPING', rows)                                           # structure beyond Phase 1 is not copied
        # the deferral of a Phase-1 question carries over as a deferral, so it is not lost (the new inventory skips Phase 1)
        self.assertEqual(list(new.pending_questions or []), ['A2'])
        self.assertEqual(self._status(new)['pending_questions'], ['A2'])
        self.assertEqual(_state(src), before_src)                                           # the earlier inventory is untouched
        # and the two stay independent from here on
        self._step(new, 'A2', {'tax_id': '1234567890'})
        self.assertEqual(_state(src), before_src)
        self.assertEqual(self._status(new)['pending_questions'], [])

    def test_a_deferral_that_no_longer_applies_is_not_carried(self):
        src = self._earlier()
        CarbonReport.objects.filter(pk=src.pk).update(pending_questions=['A7a', 'A2'])    # A7 is "no": A7a does not apply
        new = self._start()
        self.client.post(f'/api/questionnaire/{new.id}/reuse-profile/', {'reporting_year': 2025}, format='json')
        new.refresh_from_db()
        self.assertEqual(list(new.pending_questions or []), ['A2'])


class StoredAnswersMatchTheQuestionnaireTests(_Base):
    """The server reads answers as they are STORED (Phase 1 under named fields, the rest as {'answer': x}); the
    route logic is verified on the questionnaire's own shape. This closes the gap: complete routes, stored the way
    the app stores them, give the same route, no open required question, and the server accepts the sign-off."""

    PHASE1 = {
        'A7': lambda v: {'has_previous_report': True if v == 'yes' else False if v == 'no' else None},
        'A7a': lambda v: {'baseline_year': int(v) if str(v).isdigit() else None},
        'B1': lambda v: {'nace_code': str(v).replace('NACE_', '', 1)},
        'C1': lambda v: {'has_subsidiaries': v == 'yes'},
        'C2': lambda v: {'has_international': v == 'yes'},
        'C3': lambda v: {'has_jv_franchise': v == 'yes'},
        'D1': lambda v: {'ef_database': v}, 'D3': lambda v: {'boundary_approach': v}, 'D4': lambda v: {'scope3_approach': v},
    }

    def _store(self, report, fe_answers):
        for step, value in fe_answers.items():
            raw = fe_answers[step]
            val = raw['answer'] if isinstance(raw, dict) and 'answer' in raw else raw
            stored = self.PHASE1[step](val) if step in self.PHASE1 else {'answer': val}
            ReportStep.objects.update_or_create(report=report, step_id=step, defaults={'answer': stored})

    def _routes(self, n):
        import json
        from pathlib import Path
        data = json.load(open(Path(__file__).with_name('deferral_parity.json'), encoding='utf-8'))['scenarios']
        return [s for s in data if s.get('kind') == 'complete'][:n]

    def test_stored_answers_give_the_same_route_and_no_open_required_question(self):
        for s in self._routes(25):
            report = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2025)
            self._store(report, s['answers'])
            stored = deferral.saved_answers(report)
            self.assertEqual(deferral.route_ids(stored), s['route'], s['label'])
            self.assertEqual(deferral.required_unanswered(stored), [], s['label'])

    def test_the_server_accepts_the_sign_off_of_a_complete_route(self):
        done = 0
        for s in self._routes(4):
            report = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2020 + done,
                                                 status=CarbonReport.Status.IN_PROGRESS)
            answers = {k: v for k, v in s['answers'].items() if k != '7B-INFO'}
            self._store(report, answers)
            r = self._step(report, '7B-INFO', {'answer': 'done'})
            self.assertEqual((r.status_code, r.data.get('code')), (200, None), (s['label'], r.content[:300]))
            self.assertTrue(r.data.get('completed'))
            done += 1
        self.assertEqual(done, 4)

    def test_the_same_route_missing_one_required_answer_is_refused(self):
        s = self._routes(1)[0]
        report = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=2019,
                                             status=CarbonReport.Status.IN_PROGRESS)
        answers = {k: v for k, v in s['answers'].items() if k not in ('7B-INFO', 'SCOPE-GROUPING')}
        self._store(report, answers)
        r = self._step(report, '7B-INFO', {'answer': 'done'})
        self.assertEqual((r.status_code, r.data['code']), (400, 'required_unanswered'))
        self.assertIn('SCOPE-GROUPING', r.data['required_unanswered'])
        self.assertNotEqual(CarbonReport.objects.get(pk=report.pk).status, CarbonReport.Status.COMPLETED)
