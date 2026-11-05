// @ts-check
// "I don't know — answer later": WHICH questions may be left for later, decided by what the question does
// in the questionnaire, never by how it looks.
//
//   required     the answer routes the questionnaire (a yes/no gate, a summary confirmation), defines what
//                the later questions are about (loop sources, the boundary, the methodology, the scope
//                grouping) or is the sign-off itself. Leaving it blank would make the route, the boundary
//                or the method a guess — so it cannot be deferred, here or on the server.
//   deferrable   profile details, documentation and data inputs that change neither the route nor the
//                method. May be left unanswered for now (nothing is saved, not even 0) and answered later.
//   conditional  on the route only for some answers (a follow-up of a "yes", a question that exists only
//                for one boundary approach ...). `then` says what it is once it applies. When the answers
//                take it off the route it is inactive: not pending, not counted, not deferrable.
//   info         an information screen or a section picker: not a question.
//
// Per-item answers of a loop (one per facility, fuel, vehicle ...) are 'required' with code 'loop_item':
// the loop's source question defines the items and each item is answered when the loop runs.
//
// The policy (deferralPolicy.js) is GENERATED from questions.js and mirrored by the server
// (carbonless_backend/questionnaire/deferral_policy.json + deferral.py); both walk the same route logic,
// pinned by shared fixtures. Nothing here calculates anything.
import POLICY from './deferralPolicy.js';

/** The answer behind a question id; the `{ answer }` wrapper of saved answers is unwrapped. */
export function readAnswerValue(answersMap, questionId) {
  const v = answersMap?.[questionId];
  if (v && typeof v === 'object' && !Array.isArray(v) && 'answer' in v) return v.answer;
  return v;
}

/**
 * Evaluates a `conditionalShow` / `conditionalRequired` rule against the answers.
 * A finished loop question stores an aggregate map keyed by loop item (a scalar per item, or a compound per
 * item); `field` drills into one compound sub-field before the value check runs.
 */
export function conditionalShowMatches(conditionalShow, answersMap) {
  if (!conditionalShow) return true;
  const { questionId, field, includesValue, inValues, equals, greaterThan, unitIn, hasKey } = conditionalShow;
  const raw = readAnswerValue(answersMap, questionId);
  if (hasKey) {
    return !!(raw && typeof raw === 'object' && !Array.isArray(raw) && String(raw[hasKey] ?? '').trim());
  }
  if (unitIn) {
    const vals = raw && typeof raw === 'object' ? Object.values(raw) : [raw];
    return vals.some(v => typeof v === 'string' && unitIn.includes(v.trim().split(/\s+/).pop()));
  }
  let candidates;
  if (Array.isArray(raw)) {
    candidates = raw;
  } else if (raw && typeof raw === 'object') {
    const values = Object.values(raw);
    const isLoopOfCompounds = values.length > 0 && values.every(v => v && typeof v === 'object');
    if (field) {
      candidates = isLoopOfCompounds ? values.map(v => v[field]) : [raw[field]];
    } else {
      candidates = isLoopOfCompounds ? [] : values;
    }
  } else {
    candidates = [raw];
  }
  if (inValues) return candidates.some(v => inValues.includes(v));
  if (equals !== undefined) {
    return candidates.some(v => (typeof equals === 'number' ? Number(v) === equals : v === equals));
  }
  if (greaterThan !== undefined) return candidates.some(v => Number(v) > greaterThan);
  return candidates.includes(includesValue);
}

/** The English / Turkish explanation for each reason a question cannot be left for later. */
export function deferralCopy(tr) {
  return tr ? {
    gate: 'Bu yanıt, sonraki soruların hangileri olacağını belirler. Yanıtsız bırakılırsa yol tahmine dayanır; bu yüzden sonraya bırakılamaz.',
    structure: 'Bu yanıt anketin yapısını belirler (hangi soruların sorulacağı). Sonraya bırakılamaz.',
    boundary: 'Bu yanıt kurumsal sınırı belirler (neyin envantere dahil olduğu). Sonraya bırakılamaz.',
    methodology: 'Bu yanıt hesaplama yöntemini veya veri kaynağını belirler. Sonraya bırakılamaz.',
    calc_prerequisite: 'Bu yanıt, sonraki hesapların ön koşuludur. Sonraya bırakılamaz.',
    loop_source: 'Bu yanıt, sonraki soruların hangi tesis, ekipman veya kalemler için sorulacağını belirler. Sonraya bırakılamaz.',
    loop_item: 'Bu soru, her kalem için sırayla yanıtlanır; kalemler bir önceki yanıtla belirlendi. Bu soru tek tek sonraya bırakılamaz.',
    identity: 'Bu yanıt envanteri tanımlar (kurum veya raporlama yılı). Sonraya bırakılamaz.',
    sign_off: 'İmza ve beyan, envanteri tamamlayan adımdır. Sonraya bırakılamaz.',
    not_applicable: 'Verdiğiniz yanıtlara göre bu soru şu an geçerli değil.',
    already_answered: 'Bu soru zaten yanıtlandı.',
    info: 'Bu bir bilgi ekranıdır, soru değildir.',
    unknown: 'Bu, tanınan bir anket sorusu değil.',
    prefix: 'Sonraya bırakılamaz: ',
    mustAnswer: 'Devam etmek için bu soruyu yanıtlayın. ',
  } : {
    gate: 'This answer decides which questions come next. Left blank, the route would be a guess, so it cannot be left for later.',
    structure: 'This answer decides the structure of the questionnaire (which questions are asked). It cannot be left for later.',
    boundary: 'This answer decides the organizational boundary (what the inventory includes). It cannot be left for later.',
    methodology: 'This answer decides the calculation method or data source. It cannot be left for later.',
    calc_prerequisite: 'This answer is a prerequisite of the calculations that follow. It cannot be left for later.',
    loop_source: 'This answer decides which facilities, equipment or items the next questions are asked about. It cannot be left for later.',
    loop_item: 'This question is answered item by item, for the items the previous answer defined. It cannot be left for later one by one.',
    identity: 'This answer identifies the inventory (the organization or the reporting year). It cannot be left for later.',
    sign_off: 'The signature and declaration complete the inventory. They cannot be left for later.',
    not_applicable: 'Given your answers, this question does not apply right now.',
    already_answered: 'This question is already answered.',
    info: 'This is an information screen, not a question.',
    unknown: 'This is not a recognized questionnaire question.',
    prefix: 'Cannot be left for later: ',
    mustAnswer: 'Answer this question to continue. ',
  };
}

/**
 * The engine over one policy. `createDeferral(policy)` is exported so tests and the generator can run it on
 * their own policy; the app uses the generated one (see the exports at the bottom).
 * @param {{ questions: Record<string, any> }} policy
 */
export function createDeferral(policy) {
  const Q = policy.questions;

  /** Same routing as getNextQuestionId (questions.js), over the policy's graph. */
  function nextQuestionId(q, answer) {
    if (!q) return null;
    if (q.nbv) {
      if (typeof answer === 'string') {
        if (answer in q.nbv) return q.nbv[answer];
        return q.next ?? null;
      }
      if (Array.isArray(answer)) {
        const exclusive = new Set(q.exclusive || []);
        for (const v of answer) if (exclusive.has(v) && v in q.nbv) return q.nbv[v];
        for (const v of answer) if (!exclusive.has(v) && v in q.nbv) return q.nbv[v];
      }
    }
    return q.next ?? null;
  }

  /**
   * The ids on this user's route, in order — walked from the first question along the answers given
   * (branches, hidden conditional questions, loops), and past the last answer along each question's default.
   * Answers left on a branch the user turned away from are not on the route. Section pickers only lead back
   * into earlier sections while editing, so the walk takes the forward branch.
   * `loopHasItems(q, answers)` lets the app tell that a loop has no items (then it is skipped); the default
   * assumes it has. `confirmed` stops the walk at the first gate that is still unanswered: what lies beyond
   * it depends on an answer that does not exist yet, so it is not (yet) known to apply.
   * @param {Record<string, any>} answers
   * @param {{ loopHasItems?: (q: any, answers: Record<string, any>, id: string) => boolean, confirmed?: boolean }} [opts]
   * @returns {string[]}
   */
  function routeIds(answers, opts = {}) {
    const src = answers || {};
    const loopHasItems = opts.loopHasItems || (() => true);
    const path = [];
    const seen = new Set();
    let id = 'A1';
    while (id && !seen.has(id) && path.length < 2000) {
      const q = Q[id];
      if (!q) break;
      seen.add(id);
      if (q.show && !(id in src) && !conditionalShowMatches(q.show, src)) {
        id = q.next || q.loopNext || null;
        continue;
      }
      if (q.loop && !(id in src) && !loopHasItems(q, src, id)) {
        id = q.loopNext || q.next || null;
        continue;
      }
      if (q.type === 'section_picker') { id = q.next || null; continue; }
      path.push(id);
      const answered = id in src;
      if (opts.confirmed && !answered && q.nbv && !q.loop && q.type !== 'info') break;
      const value = answered ? readAnswerValue(src, id) : undefined;
      let next;
      if (q.loop) next = q.loopNext || q.next || null;
      else if (q.type === 'info' || !answered) {
        next = q.next || q.loopNext || (q.nbv ? Object.values(q.nbv).find(Boolean) : null) || null;
      } else next = nextQuestionId(q, value);
      if (next === '4-GİRİŞ' && readAnswerValue(src, 'SCOPE-GROUPING') !== 'separate') {
        next = Q['4-GİRİŞ']?.next || next;
      }
      const backwards = (n) => !n || seen.has(n) || Q[n]?.type === 'section_picker';
      if (next && backwards(next)) {
        const alts = [q.next, ...Object.values(q.nbv || {}), q.loopNext];
        next = alts.find(n => n && !backwards(n)) || null;
      }
      id = next;
    }
    return path;
  }

  /** What the question is once it applies: 'required' | 'deferrable' | 'info'. */
  function effectiveKind(q) {
    if (!q) return 'unknown';
    return q.kind === 'conditional' ? q.then : q.kind;
  }

  /** Whether a question must be answered given the answers (the question's own rule, or its conditional one). */
  function mustAnswer(q, answers) {
    if (!q || q.kind === 'info' || q.loop) return false;
    if (q.req) return true;
    return !!(q.creq && conditionalShowMatches(q.creq, answers));
  }

  /**
   * May this question be left for later, given the answers? `{ ok, code }`; code is one of the keys of
   * deferralCopy (why not). The server answers the same way (questionnaire/deferral.py).
   */
  function deferStatus(id, answers) {
    const q = Q[id];
    if (!q) return { ok: false, code: 'unknown' };
    if (q.kind === 'info') return { ok: false, code: 'info' };
    if (id in (answers || {})) return { ok: false, code: 'already_answered' };
    // A question that applies whatever the answers (a gate, the boundary, a method ...) is required wherever the
    // user is in the questionnaire; only a conditional one first needs to be on the route.
    if (q.kind === 'required') return { ok: false, code: q.code || 'gate' };
    if (!new Set(routeIds(answers, { confirmed: true })).has(id)) return { ok: false, code: 'not_applicable' };
    if (effectiveKind(q) === 'required') return { ok: false, code: q.code || 'gate' };
    return { ok: true, code: 'deferrable' };
  }

  /** Pending ids still to show: unique, unanswered and on the route (a deferred question the answers have
   *  since taken off the route is inactive, so it is neither pending nor counted). A question beyond a gate
   *  that is still unanswered is unknown, not inactive, so it stays listed; only a NEW deferral needs the
   *  confirmed route (deferStatus). */
  function activePending(ids, answers, opts = {}) {
    const route = new Set(routeIds(answers, opts));
    const seen = new Set();
    const out = [];
    for (const id of Array.isArray(ids) ? ids : []) {
      if (typeof id !== 'string' || seen.has(id) || (answers && id in answers) || !route.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }

  /** Questions on the route that must be answered and are not (the inventory cannot be completed around them). */
  function requiredUnanswered(answers) {
    return routeIds(answers).filter(id => {
      const q = Q[id];
      return mustAnswer(q, answers) && !(id in (answers || {}));
    });
  }

  return { policy, nextQuestionId, routeIds, effectiveKind, mustAnswer, deferStatus, activePending, requiredUnanswered };
}

const engine = createDeferral(/** @type {any} */ (POLICY));
export const policy = engine.policy;
export const routeIds = engine.routeIds;
export const deferStatus = engine.deferStatus;
export const activePending = engine.activePending;
export const requiredUnanswered = engine.requiredUnanswered;
export const effectiveKind = engine.effectiveKind;
export const mustAnswer = engine.mustAnswer;
