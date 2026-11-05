"""The four edge cases the exhaustive route audit does not cover: answers left on an abandoned branch, editing a
saved answer, loops with no items, and the workspace chat. Every test is about STATE the user can reach; none
changes how anything is calculated.
"""
import json
import re
from pathlib import Path
from unittest import mock

from django.contrib.auth.models import User
from rest_framework.test import APIClient

from accounts.models import UserProfile
from companies.models import Company, CompanyMembership
from emissions.models import EmissionEntry
from . import deferral
from . import test_deferral_lifecycle as lc
from .models import CarbonReport, ReportStep
from .step_entries import activities_for_report

_BASE = Path(__file__).parent
DONE = {'7B-INFO': {'answer': 'done'}}      # the sign-off is saved before it is checked


def _complete_scenarios():
    data = json.load(open(_BASE / 'deferral_parity.json', encoding='utf-8'))['scenarios']
    return [s for s in data if s.get('kind') == 'complete']


def _stored(step, value):
    mk = lc.StoredAnswersMatchTheQuestionnaireTests.PHASE1.get(step)
    return mk(value['answer'] if isinstance(value, dict) and 'answer' in value else value) if mk else (
        value if isinstance(value, dict) and 'answer' in value else {'answer': value})


class _Base(lc._Base):
    def _report(self, answers, year, pending=(), status=CarbonReport.Status.IN_PROGRESS):
        report = CarbonReport.objects.create(company=self.company, created_by=self.user, reporting_year=year,
                                             status=status, pending_questions=list(pending))
        for step, value in answers.items():
            ReportStep.objects.create(report=report, step_id=step, answer=_stored(step, value))
        return report

    def _rows(self, report):
        return {s: a for s, a, _ in lc._rows(report)}

    def _sign_off(self, report):
        return self._step(report, '7B-INFO', {'answer': 'done'})


# ── 1. answers left on a branch the user turned away from ──────────────────────────────────────────────────────

class StaleAnswersTests(_Base):

    def _a7(self, report, yes):
        r = self._step(report, 'A7', {'has_previous_report': yes})
        self.assertEqual(r.status_code, 200, r.content)

    def _with_a7_yes(self, year, **extra):
        s = next(x for x in _complete_scenarios() if x['answers'].get('A7') == 'yes')
        answers = {k: v for k, v in s['answers'].items() if k not in ('7B-INFO', 'A7a')}
        report = self._report(answers, year, **extra)
        return report

    def test_a_follow_up_answer_survives_its_gate_being_changed_and_comes_back_with_it(self):
        report = self._with_a7_yes(2025)
        ReportStep.objects.create(report=report, step_id='A7a', answer={'baseline_year': 2019})
        self._a7(report, False)                                           # the user turns away from A7a's branch
        rows = self._rows(report)
        self.assertEqual(rows['A7a'], {'baseline_year': 2019})            # not deleted, not altered
        self.assertNotIn('A7a', deferral.route_ids(deferral.saved_answers(report)))      # off the route
        self._a7(report, True)                                            # and back again
        self.assertEqual(self._rows(report)['A7a'], {'baseline_year': 2019})   # the saved state is what it was
        self.assertIn('A7a', deferral.route_ids(deferral.saved_answers(report)))

    def test_pending_questions_list_only_the_active_route_and_the_mark_is_not_deleted(self):
        report = self._with_a7_yes(2026)
        self.assertEqual(self._mark(report, 'A7a').status_code, 200)
        self.assertEqual(self._status(report)['pending_questions'], ['A7a'])
        self._a7(report, False)
        self.assertEqual(self._status(report)['pending_questions'], [])                         # inactive: not shown
        self.assertEqual(CarbonReport.objects.get(pk=report.pk).pending_questions, ['A7a'])     # but kept, not deleted
        self._a7(report, True)
        self.assertEqual(self._status(report)['pending_questions'], ['A7a'])                    # active again

    def test_an_inactive_pending_question_does_not_block_completion_nor_an_inactive_answer_count(self):
        s = _complete_scenarios()[0]
        answers = {k: v for k, v in s['answers'].items() if k != '7B-INFO'}
        stale = [q for q in deferral.policy() if q not in s['route'] and q in ('A7a', 'K3C14-1', '6B-2')][:1]
        report = self._report(answers, 2001, pending=stale or [])
        r = self._sign_off(report)
        self.assertEqual((r.status_code, r.data.get('code')), (200, None), r.content[:300])
        self.assertEqual(CarbonReport.objects.get(pk=report.pk).pending_questions, stale)      # nothing removed

    def test_an_answer_behind_a_gate_answered_no_does_not_reach_the_calculation_and_returns_with_the_gate(self):
        base = {'3B-5': {'EQ-3B-05': 'diesel'}, '3B-6': {'EQ-3B-05': 'fuel_litres'},
                '3B-7': {'EQ-3B-05': '1.000 litre'}}
        with_yes = activities_for_report({**base, '3B-0': {'answer': 'yes'}}, 2025, factor_exists=lambda s: True)
        with_no = activities_for_report({**base, '3B-0': {'answer': 'no'}}, 2025, factor_exists=lambda s: True)
        again = activities_for_report({**base, '3B-0': {'answer': 'yes'}}, 2025, factor_exists=lambda s: True)
        self.assertTrue(with_yes['3B-7'])
        self.assertEqual(with_no['3B-7'], [])                       # the stale answer counts for nothing
        self.assertEqual(again['3B-7'], with_yes['3B-7'])           # and is the same amount when the gate says yes
        self.assertEqual(with_no['3B-7'] == [], True)


# ── 2. changing a saved answer (edit mode) ─────────────────────────────────────────────────────────────────────

class EditModeTests(_Base):
    """The review screen lets the user change a saved answer. The server then holds the new answer next to all the
    others; what follows must be decided by the route the new answers give."""

    def _gate_flips(self, scenario, limit=5):
        P = deferral.policy()
        flips = []
        for qid in scenario['route']:
            q = P[qid]
            cur = scenario['answers'].get(qid)
            cur = cur['answer'] if isinstance(cur, dict) and 'answer' in cur else cur
            if not q.get('nbv') or not isinstance(cur, str) or cur not in q['nbv'] or q['type'] == 'info':
                continue
            for alt in q['nbv']:
                if alt != cur and isinstance(alt, str):
                    flips.append((qid, alt))
        step = max(1, len(flips) // limit)
        return flips[::step][:limit]

    def test_a_changed_gate_changes_the_route_keeps_every_answer_and_enforces_what_became_required(self):
        year, checked, refused, accepted = 2002, 0, 0, 0
        for scenario in _complete_scenarios()[:6]:
            answers = {k: v for k, v in scenario['answers'].items() if k != '7B-INFO'}
            for gate, alt in self._gate_flips(scenario):
                new = dict(answers)
                new[gate] = {'answer': alt} if isinstance(answers[gate], dict) and 'answer' in answers[gate] else alt
                expected_missing = deferral.required_unanswered({**new, **DONE})
                report = self._report(answers, year)
                year += 1
                before = self._rows(report)
                # the edit, exactly as the review screen saves it: one step, same endpoint
                ReportStep.objects.filter(report=report, step_id=gate).update(answer=_stored(gate, new[gate]))
                after = self._rows(report)
                self.assertEqual({k: v for k, v in after.items() if k != gate},
                                 {k: v for k, v in before.items() if k != gate}, (gate, alt))   # nothing else touched
                stored = {**deferral.saved_answers(report), **DONE}
                self.assertEqual(deferral.route_ids(stored), deferral.route_ids({**new, **DONE}), (gate, alt))
                self.assertEqual(deferral.required_unanswered(stored), expected_missing, (gate, alt))
                r = self._sign_off(report)
                if expected_missing:
                    self.assertEqual((r.status_code, r.data['code']), (400, 'required_unanswered'), (gate, alt))
                    self.assertEqual(r.data['required_unanswered'], expected_missing, (gate, alt))
                    self.assertNotEqual(CarbonReport.objects.get(pk=report.pk).status, CarbonReport.Status.COMPLETED)
                    refused += 1
                else:
                    self.assertEqual((r.status_code, r.data.get('code')), (200, None), (gate, alt, r.content[:200]))
                    accepted += 1
                checked += 1
        self.assertGreaterEqual(checked, 15)
        self.assertGreater(refused, 0)       # at least one edit really did open a required question
        self.assertGreater(accepted, 0)      # and at least one really did not (no false blocking)

    def test_changing_the_gate_back_restores_the_original_state(self):
        scenario = _complete_scenarios()[1]
        answers = {k: v for k, v in scenario['answers'].items() if k != '7B-INFO'}
        gate, alt = self._gate_flips(scenario, limit=1)[0]
        report = self._report(answers, 2050)
        original = self._rows(report)
        route_before = deferral.route_ids({**deferral.saved_answers(report), **DONE})
        ReportStep.objects.filter(report=report, step_id=gate).update(answer=_stored(gate, alt))
        ReportStep.objects.filter(report=report, step_id=gate).update(answer=original[gate])
        self.assertEqual(self._rows(report), original)
        self.assertEqual(deferral.route_ids({**deferral.saved_answers(report), **DONE}), route_before)
        self.assertEqual(deferral.required_unanswered({**deferral.saved_answers(report), **DONE}), [])

    def test_an_edit_never_marks_the_inventory_complete_or_100_percent(self):
        scenario = _complete_scenarios()[0]
        answers = {k: v for k, v in scenario['answers'].items() if k != '7B-INFO'}
        report = self._report(answers, 2060)
        report.client_progress = {'answered': 40, 'total': 60}
        report.save(update_fields=['client_progress'])
        gate, alt = self._gate_flips(scenario, limit=1)[0]
        ReportStep.objects.filter(report=report, step_id=gate).update(answer=_stored(gate, alt))
        s = self._status(report)
        self.assertNotEqual(s.get('status'), 'completed')
        self.assertLess(s['progress']['percent'], 100)
        self.assertEqual(CarbonReport.objects.get(pk=report.pk).status, CarbonReport.Status.IN_PROGRESS)


# ── 3. loops with no items ─────────────────────────────────────────────────────────────────────────────────────

class EmptyLoopTests(_Base):

    def _has(self, qid, **source):
        q = deferral.policy()[qid]
        return deferral.loop_has_items(q, {k.replace('_', '-'): v for k, v in source.items()})

    def test_the_server_tells_an_empty_loop_the_way_the_questionnaire_does(self):
        P = deferral.policy()
        has = deferral.loop_has_items
        # facilities (a count): 5 → five items; blank → none
        self.assertTrue(has(P['2A-2'], {'2A-1': {'answer': '5'}}))
        self.assertFalse(has(P['2A-2'], {'2A-1': {'answer': ''}}))
        self.assertFalse(has(P['2A-2'], {}))
        # equipment (a list)
        self.assertFalse(has(P['3A-2'], {'3A-1': []}))
        self.assertFalse(has(P['3A-2'], {}))
        self.assertTrue(has(P['3A-2'], {'3A-1': ['EQ-3A-01']}))
        self.assertTrue(has(P['3A-2'], {'3A-1': {'answer': ['EQ-3A-01']}}))               # as it is stored
        # fugitive sources: the exclusive "none" is not an item
        self.assertFalse(has(P['3D-2'], {'3D-0': ['none']}))
        self.assertTrue(has(P['3D-2'], {'3D-0': ['none', 'refrigerant']}))
        # a loop over another loop's answers (fuels per equipment)
        self.assertFalse(has(P['3A-5'], {'3A-4': {'EQ-3A-01': []}}))
        self.assertTrue(has(P['3A-5'], {'3A-4': {'EQ-3A-01': ['diesel']}}))
        # a loop for some item types only (the material of raw materials and packaging)
        only = P['K3C1-3m']['lio']
        src = P['K3C1-3m']['ls']
        self.assertTrue(has(P['K3C1-3m'], {src: [only[0]]}))
        self.assertTrue(has(P['K3C1-3m'], {src: [only[0] + '#2']}))
        self.assertFalse(has(P['K3C1-3m'], {src: ['SC-99']}))

    def test_a_policy_loop_always_names_the_source_it_is_counted_from(self):
        P = deferral.policy()
        sources = deferral.policy.__globals__['_POLICY']['loopSources']
        for qid, q in P.items():
            if q.get('loop'):
                self.assertIn(q.get('ls'), sources, qid)

    def test_an_old_mark_on_a_loop_without_items_is_not_pending_and_blocks_nothing(self):
        # route #1 has no equipment (3A-1 is empty): its per-equipment questions are never asked
        s = next(x for x in _complete_scenarios() if x['answers'].get('3A-0') == 'yes' and x['answers'].get('3A-1') == [])
        answers = {k: v for k, v in s['answers'].items() if k not in ('7B-INFO', '3A-2')}
        report = self._report(answers, 2070, pending=['3A-2'])
        self.assertNotIn('3A-2', answers)
        self.assertEqual(self._status(report)['pending_questions'], [])                          # no false pending
        self.assertEqual(CarbonReport.objects.get(pk=report.pk).pending_questions, ['3A-2'])     # the mark is not deleted
        r = self._sign_off(report)
        self.assertEqual((r.status_code, r.data.get('code')), (200, None), r.content[:300])     # not blocked

    def test_the_same_old_mark_is_enforced_when_the_loop_has_items(self):
        s = next(x for x in _complete_scenarios() if x['answers'].get('3A-0') == 'yes' and x['answers'].get('3A-1'))
        answers = {k: v for k, v in s['answers'].items() if k not in ('7B-INFO', '3A-2')}
        report = self._report(answers, 2071, pending=['3A-2'])
        self.assertEqual(self._status(report)['pending_questions'], ['3A-2'])
        r = self._sign_off(report)
        self.assertEqual((r.status_code, r.data['code']), (400, 'pending_questions'))
        self.assertEqual(r.data['pending_questions'], ['3A-2'])

    def test_a_loop_item_can_never_be_deferred_so_an_empty_loop_never_gets_a_new_mark(self):
        P = deferral.policy()
        for qid, q in P.items():
            if q.get('loop'):
                ok, code = deferral.defer_status(qid, {})
                self.assertFalse(ok, qid)

    def test_required_per_item_answers_are_not_a_server_gate_so_an_empty_loop_never_blocks_the_sign_off(self):
        for s in _complete_scenarios():
            self.assertEqual(deferral.required_unanswered(s['answers']), [], s.get('label'))

    def test_marks_and_loops_do_not_touch_a_calculation(self):
        s = next(x for x in _complete_scenarios() if x['answers'].get('3A-0') == 'yes' and x['answers'].get('3A-1') == [])
        answers = {k: v for k, v in s['answers'].items() if k != '7B-INFO'}
        report = self._report(answers, 2072)
        stored = {k: v for k, v in ReportStep.objects.filter(report=report).values_list('step_id', 'answer')}
        before = activities_for_report(stored, 2072, factor_exists=lambda x: True)
        entries = EmissionEntry.objects.count()
        CarbonReport.objects.filter(pk=report.pk).update(pending_questions=['3A-2'])
        self._status(report)
        after = activities_for_report(stored, 2072, factor_exists=lambda x: True)
        self.assertEqual(before, after)
        self.assertEqual(before['3A-5'], [])                           # an empty loop reports nothing
        self.assertEqual(EmissionEntry.objects.count(), entries)


# ── 4. the workspace chat ──────────────────────────────────────────────────────────────────────────────────────

class WorkspaceChatTests(_Base):
    """The chat can read an inventory to answer; it has no way to write a questionnaire answer, mark a question
    for later, or move the route."""

    def setUp(self):
        super().setUp()
        UserProfile.objects.create(user=self.user, active_company=self.company)

    def test_no_chat_module_writes_a_questionnaire_step_or_a_pending_mark(self):
        chat_dir = _BASE.parent / 'chat'
        for path in chat_dir.glob('*.py'):
            src = path.read_text(encoding='utf-8')
            self.assertNotIn('pending_questions', src, path.name)
            self.assertNotRegex(src, r'ReportStep\.objects\.(create|update_or_create|filter\([^)]*\)\.(update|delete))', path.name)
            self.assertNotIn('import ReportStep', src, path.name)

    def test_what_the_chat_is_told_cannot_create_defer_or_change_an_answer(self):
        from chat.models import ChatSession
        report = self._report({'A1': {'legal_name': 'Lifecycle Co'}, 'A4': {'reporting_year': 2025}}, 2025,
                              pending=['2A-1'])
        before = lc._state(report)
        c = APIClient()
        c.force_authenticate(self.user)
        s = ChatSession.objects.create(user=self.user, company=self.company)
        said = ['2A-1 = 5', 'number of facilities is 3', 'answer later', 'I do not know, ask me later',
                'set SCOPE-GROUPING to separate', 'mark the inventory complete', '7B-INFO done', 'skip 3A-0']
        reply = lambda *a, **k: ('Noted.', None, 200)
        with mock.patch('chat.views._get_groq_client', return_value=object()), \
                mock.patch('chat.views._call_groq', side_effect=reply):
            for text in said:
                r = c.post(f'/api/chat/sessions/{s.id}/message/',
                           {'content': text, 'language': 'en', 'inventory_id': report.id}, format='json')
                self.assertIn(r.status_code, (200, 400, 429), (text, r.content[:200]))
        with mock.patch('chat.views._get_groq_client', return_value=None):
            for text in said:
                c.post(f'/api/chat/sessions/{s.id}/message/',
                       {'content': text, 'language': 'tr', 'inventory_id': report.id}, format='json')
        self.assertEqual(lc._state(report), before)                       # every answer, mark, status and progress as it was
        self.assertEqual(CarbonReport.objects.count(), 1)


# ── the policy files and their generators ──────────────────────────────────────────────────────────────────────

class PolicyFilesTests(_Base):
    """The two policy copies, the loop-source data and the document are produced by scripts, never by hand."""

    def test_the_policy_document_is_what_its_generator_writes_from_the_policy(self):
        import subprocess
        import sys
        script = _BASE.parents[1] / 'nexus_insights-saas-neon_nextjs' / 'scripts' / 'generate-answer-later-doc.py'
        if not script.exists():
            self.skipTest('frontend scripts not present')
        r = subprocess.run([sys.executable, str(script), '--check'], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_the_loop_data_is_complete(self):
        data = json.load(open(_BASE / 'deferral_policy.json', encoding='utf-8'))
        sources = data['loopSources']
        loops = {i: q for i, q in data['questions'].items() if q.get('loop')}
        self.assertTrue(loops)
        for qid, q in loops.items():
            self.assertIn(q.get('ls'), sources, qid)
        self.assertEqual(set(sources), {q['ls'] for q in loops.values()})          # no unused source either
        for src in sources.values():
            self.assertEqual(set(src), {'num', 'ex'})
