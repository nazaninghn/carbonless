"""Which questions may be left for later ("I don't know — answer later"), and which must be answered.

The server's twin of nexus.../src/lib/carboniq/deferral.js: the same policy (deferral_policy.json, GENERATED
from the frontend question catalogue) and the same route walk, pinned by shared fixtures
(deferral_parity.json, tests in test_deferral_policy.py and scripts/test-deferral.mjs).

  required     the answer routes the questionnaire, defines what the later questions are about (loop sources,
               boundary, methodology, scope grouping) or is the sign-off: it cannot be deferred.
  deferrable   profile details, documentation and data inputs that change neither route nor method.
  conditional  on the route only for some answers; `then` says what it is once it applies. Off the route it is
               inactive: not pending, not counted, not deferrable.
  info         an information screen or section picker: not a question.

Per-item answers of a loop are 'required' with code 'loop_item' (answered item by item).

Nothing here calculates anything and nothing here writes: it only decides what may be skipped. Answers are
never invented: a deferred question has no ReportStep (see PendingQuestionView).
"""
import json
import math
import re
from pathlib import Path

_POLICY = None

# Each reason a question cannot be left for later (and the two not-applicable cases), in both languages.
MESSAGES = {
    'gate': ('This answer decides which questions come next. Left blank, the route would be a guess, so it cannot be left for later.',
             'Bu yanıt, sonraki soruların hangileri olacağını belirler. Yanıtsız bırakılırsa yol tahmine dayanır; bu yüzden sonraya bırakılamaz.'),
    'structure': ('This answer decides the structure of the questionnaire (which questions are asked). It cannot be left for later.',
                  'Bu yanıt anketin yapısını belirler (hangi soruların sorulacağı). Sonraya bırakılamaz.'),
    'boundary': ('This answer decides the organizational boundary (what the inventory includes). It cannot be left for later.',
                 'Bu yanıt kurumsal sınırı belirler (neyin envantere dahil olduğu). Sonraya bırakılamaz.'),
    'methodology': ('This answer decides the calculation method or data source. It cannot be left for later.',
                    'Bu yanıt hesaplama yöntemini veya veri kaynağını belirler. Sonraya bırakılamaz.'),
    'calc_prerequisite': ('This answer is a prerequisite of the calculations that follow. It cannot be left for later.',
                          'Bu yanıt, sonraki hesapların ön koşuludur. Sonraya bırakılamaz.'),
    'loop_source': ('This answer decides which facilities, equipment or items the next questions are asked about. It cannot be left for later.',
                    'Bu yanıt, sonraki soruların hangi tesis, ekipman veya kalemler için sorulacağını belirler. Sonraya bırakılamaz.'),
    'loop_item': ('This question is answered item by item, for the items the previous answer defined. It cannot be left for later one by one.',
                  'Bu soru, her kalem için sırayla yanıtlanır; kalemler bir önceki yanıtla belirlendi. Bu soru tek tek sonraya bırakılamaz.'),
    'identity': ('This answer identifies the inventory (the organization or the reporting year). It cannot be left for later.',
                 'Bu yanıt envanteri tanımlar (kurum veya raporlama yılı). Sonraya bırakılamaz.'),
    'sign_off': ('The signature and declaration complete the inventory. They cannot be left for later.',
                 'İmza ve beyan, envanteri tamamlayan adımdır. Sonraya bırakılamaz.'),
    'not_applicable': ('Given the answers, this question does not apply right now.',
                       'Verilen yanıtlara göre bu soru şu an geçerli değil.'),
    'already_answered': ('This question is already answered; edit the question to change its answer.',
                         'Bu soru zaten yanıtlandı; yanıtı değiştirmek için soruyu düzenleyin.'),
    'info': ('This is an information screen, not a question.', 'Bu bir bilgi ekranıdır, soru değildir.'),
    'unknown': ('This is not a recognised questionnaire question.', 'Bu, tanınan bir anket sorusu değil.'),
}


def policy():
    global _POLICY
    if _POLICY is None:
        with open(Path(__file__).with_name('deferral_policy.json'), encoding='utf-8') as fh:
            _POLICY = json.load(fh)
    return _POLICY['questions']


def message(code, lang='en'):
    en, tr = MESSAGES.get(code, MESSAGES['gate'])
    return tr if lang == 'tr' else en


# ── answer values ───────────────────────────────────────────────────────────

def read_value(answers, qid):
    """The answer behind a question id; the {'answer': x} wrapper of saved answers is unwrapped."""
    v = (answers or {}).get(qid)
    if isinstance(v, dict) and 'answer' in v:
        return v['answer']
    return v


_MISSING = object()          # JavaScript's `undefined`: a field the answer does not have


def _js_number(v):
    """JavaScript's Number(v): '' and null are 0, undefined (a missing field) and an unparsable string are NaN."""
    if v is _MISSING:
        return math.nan
    if v is None:
        return 0.0
    if isinstance(v, bool):
        return 1.0 if v else 0.0
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip()
        if s == '':
            return 0.0
        try:
            return float(s)
        except ValueError:
            return math.nan
    return math.nan


def _truthy_str(v):
    return bool(str('' if v is None else v).strip())


def conditional_show_matches(cond, answers):
    """Same rule as conditionalShowMatches in deferral.js (and the questionnaire UI)."""
    if not cond:
        return True
    raw = read_value(answers, cond.get('questionId')) if cond.get('questionId') in (answers or {}) else _MISSING
    if cond.get('hasKey'):
        return bool(isinstance(raw, dict) and _truthy_str(raw.get(cond['hasKey'])))
    if cond.get('unitIn'):
        vals = list(raw.values()) if isinstance(raw, dict) else [raw]
        return any(isinstance(v, str) and (v.strip().split() or [''])[-1] in cond['unitIn'] for v in vals)
    if isinstance(raw, list):
        candidates = raw
    elif isinstance(raw, dict):
        values = list(raw.values())
        is_loop_of_compounds = bool(values) and all(isinstance(v, (dict, list)) for v in values)
        field = cond.get('field')
        if field:
            candidates = ([v.get(field, _MISSING) if isinstance(v, dict) else _MISSING for v in values]
                          if is_loop_of_compounds else [raw.get(field, _MISSING)])
        else:
            candidates = [] if is_loop_of_compounds else values
    else:
        candidates = [raw]
    if cond.get('inValues'):
        return any(v in cond['inValues'] for v in candidates)
    if 'equals' in cond:
        eq = cond['equals']
        if isinstance(eq, (int, float)) and not isinstance(eq, bool):
            return any(_js_number(v) == eq for v in candidates)
        return any(v == eq for v in candidates)
    if 'greaterThan' in cond:
        return any(_js_number(v) > cond['greaterThan'] for v in candidates)
    return cond.get('includesValue') in candidates


# ── the route ───────────────────────────────────────────────────────────────

def next_question_id(q, answer):
    """Same routing as getNextQuestionId (questions.js)."""
    if not q:
        return None
    nbv = q.get('nbv')
    if nbv:
        if isinstance(answer, str):
            return nbv[answer] if answer in nbv else q.get('next')
        if isinstance(answer, list):
            exclusive = set(q.get('exclusive') or [])
            for v in answer:
                if v in exclusive and v in nbv:
                    return nbv[v]
            for v in answer:
                if v not in exclusive and v in nbv:
                    return nbv[v]
    return q.get('next')


def route_ids(answers, loop_has_items=None, confirmed=False):
    """The ids on this user's route, in order (the questionnaire's own walk: branches, hidden conditional
    questions, loops; answers left on a branch the user turned away from are not on the route).
    `confirmed` stops at the first gate still unanswered: what lies beyond it depends on an answer that does
    not exist yet, so it is not (yet) known to apply."""
    Q = policy()
    src = answers or {}
    path, seen = [], set()
    cur = 'A1'
    while cur and cur not in seen and len(path) < 2000:
        q = Q.get(cur)
        if q is None:
            break
        seen.add(cur)
        if q.get('show') and cur not in src and not conditional_show_matches(q['show'], src):
            cur = q.get('next') or q.get('loopNext') or None
            continue
        if q.get('loop') and cur not in src and loop_has_items is not None and not loop_has_items(q, src):
            cur = q.get('loopNext') or q.get('next') or None
            continue
        if q['type'] == 'section_picker':
            cur = q.get('next') or None
            continue
        path.append(cur)
        answered = cur in src
        if confirmed and not answered and q.get('nbv') and not q.get('loop') and q['type'] != 'info':
            break
        value = read_value(src, cur) if answered else None
        if q.get('loop'):
            nxt = q.get('loopNext') or q.get('next') or None
        elif q['type'] == 'info' or not answered:
            first = next((x for x in (q.get('nbv') or {}).values() if x), None)
            nxt = q.get('next') or q.get('loopNext') or first or None
        else:
            nxt = next_question_id(q, value)
        if nxt == '4-GİRİŞ' and read_value(src, 'SCOPE-GROUPING') != 'separate':
            nxt = (Q.get('4-GİRİŞ') or {}).get('next') or nxt

        def backwards(n):
            return (not n) or n in seen or (Q.get(n) or {}).get('type') == 'section_picker'
        if nxt and backwards(nxt):
            alts = [q.get('next'), *(q.get('nbv') or {}).values(), q.get('loopNext')]
            nxt = next((n for n in alts if n and not backwards(n)), None)
        cur = nxt
    return path


# ── the policy decisions ────────────────────────────────────────────────────

def effective_kind(q):
    if not q:
        return 'unknown'
    return q.get('then') if q['kind'] == 'conditional' else q['kind']


def must_answer(q, answers):
    """Whether the question has to be answered given the answers (its own rule, or its conditional one)."""
    if not q or q['kind'] == 'info' or q.get('loop'):
        return False
    if q.get('req'):
        return True
    return bool(q.get('creq') and conditional_show_matches(q['creq'], answers))


def defer_status(qid, answers):
    """May this question be left for later? (ok, code). `code` is a key of MESSAGES when not ok."""
    q = policy().get(qid)
    if not q:
        return False, 'unknown'
    if q['kind'] == 'info':
        return False, 'info'
    if qid in (answers or {}):
        return False, 'already_answered'
    # A question that applies whatever the answers (a gate, the boundary, a method ...) is required wherever the
    # user is in the questionnaire; only a conditional one first needs to be on the route.
    if q['kind'] == 'required':
        return False, q.get('code') or 'gate'
    if qid not in set(route_ids(answers, confirmed=True)):
        return False, 'not_applicable'
    if effective_kind(q) == 'required':
        return False, q.get('code') or 'gate'
    return True, 'deferrable'


def _js_truthy(x):
    return not (x is None or x is False or x == '' or (isinstance(x, (int, float)) and not isinstance(x, bool)
                                                       and (x == 0 or x != x)))


def loop_has_items(q, answers):
    """Whether a per-item (loop) question has any item to ask about: the questionnaire's own rule
    (buildLoopItems in CarbonAIPage.jsx) for the items its source question defined. A loop with no items is
    skipped by the questionnaire, so a question of it cannot be answered and is not pending."""
    ls = q.get('ls')
    if not ls:
        return True
    policy()
    info = (_POLICY or {}).get('loopSources', {}).get(ls) or {}
    src = read_value(answers, ls)
    if info.get('num'):
        digits = re.sub(r'\D', '', '' if src is None else str(src))
        if digits and int(digits) > 0:
            return True
    items = []
    if isinstance(src, list):
        items = list(src)
    elif isinstance(src, str) and src.strip():
        items = [s.strip() for s in re.split(r'[\n,]+', src) if s.strip()]
    elif isinstance(src, dict):
        for v in src.values():
            for x in (v if isinstance(v, list) else ([] if v is None else [v])):
                if _js_truthy(x) and x not in items:
                    items.append(x)
    exclusive = info.get('ex') or []
    items = [x for x in items if x not in exclusive]
    if q.get('lio'):
        items = [x for x in items if ('' if x is None else str(x)).split('#')[0] in q['lio']]
    return len(items) > 0


def active_pending(ids, answers, loop_has_items=None):
    """Pending ids still to show: unique, unanswered and on the route. A question beyond a gate that is still
    unanswered is unknown, not inactive, so it stays listed; only a NEW deferral needs the confirmed route.
    `loop_has_items` (see route_ids) drops a mark on a question of a loop that has no items."""
    route = set(route_ids(answers, loop_has_items))
    seen, out = set(), []
    for qid in ids if isinstance(ids, list) else []:
        if not isinstance(qid, str) or qid in seen or qid in (answers or {}) or qid not in route:
            continue
        seen.add(qid)
        out.append(qid)
    return out


def required_unanswered(answers):
    """Questions on the route that must be answered and are not."""
    Q = policy()
    return [qid for qid in route_ids(answers)
            if must_answer(Q.get(qid), answers) and qid not in (answers or {})]


# ── the saved answers, in the shape the route walk expects ──────────────────

def _unmap_phase1(qid, raw):
    """The questionnaire-side value of a Phase-1 answer (A1-D4 are saved under named backend fields).
    Only the ones the route reads are needed; None when it cannot be told."""
    if not isinstance(raw, dict):
        return None
    if qid == 'A7':
        hp = raw.get('has_previous_report')
        return 'yes' if hp is True else 'no' if hp is False else 'skip'
    if qid == 'A7a':
        return str(raw['baseline_year']) if raw.get('baseline_year') is not None else None
    if qid == 'B1':
        return f"NACE_{raw['nace_code']}" if raw.get('nace_code') else None
    if qid == 'C1':
        return 'yes' if raw.get('has_subsidiaries') else 'no'
    if qid == 'C2':
        return 'yes' if raw.get('has_international') else 'no'
    if qid == 'C3':
        return 'yes' if raw.get('has_jv_franchise') else 'no'
    if qid == 'D1':
        return raw.get('ef_database') or None
    if qid == 'D3':
        return raw.get('boundary_approach') or None
    if qid == 'D4':
        return raw.get('scope3_approach') or None
    return None


def saved_answers(report):
    """{step id: value} of an inventory's saved answers, shaped like the questionnaire's own state, so the
    same route walk applies. A step with a saved row counts as answered."""
    from .models import ReportStep
    out = {}
    for step_id, raw in ReportStep.objects.filter(report=report).values_list('step_id', 'answer'):
        if isinstance(raw, dict) and 'answer' in raw:
            out[step_id] = raw
            continue
        mapped = _unmap_phase1(step_id, raw)
        out[step_id] = mapped if mapped is not None else (raw if raw is not None else '')
    return out


def pending_to_show(report, answers=None):
    """The report's pending ids that still apply: unanswered and on the route."""
    ids = [s for s in (report.pending_questions or []) if isinstance(s, str)]
    return active_pending(ids, saved_answers(report) if answers is None else answers, loop_has_items)
