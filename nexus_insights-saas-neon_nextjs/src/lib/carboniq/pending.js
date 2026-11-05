// @ts-check
import { deferStatus, activePending, deferralCopy } from './deferral.js';
// "I don't know — answer later": the copy (English / Turkish, following the UI language) and the
// small pure helpers behind the pending-questions list. A pending question is unanswered on
// purpose; the backend keeps the ids (CarbonReport.pending_questions) and never stores an answer.

/** @param {boolean} tr  true = Turkish UI */
export function pendingCopy(tr) {
  return tr ? {
    button: 'Bilmiyorum — sonra yanıtla',
    buttonHint: 'Bu soruyu yanıtsız bırakır ve sonra dönebilmeniz için "Bekleyen sorular" listesine ekler. Hiçbir değer (0 dahil) kaydedilmez.',
    saving: 'Kaydediliyor…',
    title: 'Bekleyen sorular',
    banner: 'Bu envanterde yanıtlanmamış sorularınız var.',
    badge: 'Yanıtsız',
    answerLater: 'Sonra yanıtla',
    returnTo: 'Soruya dön',
    question: 'Soru',
    marked: 'Soru yanıtsız olarak işaretlendi. "Bekleyen sorular" listesinden geri dönebilirsiniz.',
    failed: 'Soru işaretlenemedi. Lütfen tekrar deneyin.',
    noNext: 'Bu son soruydu. Envanteri tamamlamak için "Bekleyen sorular" listesindeki soruları yanıtlayın.',
    toggleOpen: 'Bekleyen soruları göster',
    toggleClose: 'Bekleyen soruları gizle',
    count: (/** @type {number} */ n) => `${n} soru bekliyor`,
  } : {
    button: "I don't know — answer later",
    buttonHint: 'Leaves this question unanswered and adds it to "Pending questions" so you can return to it. No value (not even 0) is saved.',
    saving: 'Saving…',
    title: 'Pending questions',
    banner: 'This inventory has unanswered questions.',
    badge: 'Unanswered',
    answerLater: 'Answer later',
    returnTo: 'Return to question',
    question: 'Question',
    marked: 'Question marked as unanswered. You can return to it from "Pending questions".',
    failed: 'Could not mark the question. Please try again.',
    noNext: 'That was the last question. Answer the questions in "Pending questions" to finish the inventory.',
    toggleOpen: 'Show pending questions',
    toggleClose: 'Hide pending questions',
    count: (/** @type {number} */ n) => `${n} question${n === 1 ? '' : 's'} waiting`,
  };
}

/**
 * Pending ids still to show: in the order they were marked, without any that has since been answered
 * and without duplicates (the server clears a question when its answer is saved; `answers` is the
 * client's view, which can be a moment ahead).
 * @param {unknown} ids
 * @param {Record<string, unknown> | null | undefined} answers
 * @returns {string[]}
 */
export function visiblePending(ids, answers) {
  const seen = new Set();
  const out = [];
  for (const id of Array.isArray(ids) ? ids : []) {
    if (typeof id !== 'string' || seen.has(id) || (answers && id in answers)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Whether "I don't know — answer later" is offered for a question: a real question (not an info
 * screen), not one that repeats per item (a loop's per-item answers are saved item by item), not
 * already answered, in an inventory that can still change — and, given `answers`, one the policy
 * allows to be left for later: a question that routes the questionnaire, sets the boundary or the
 * method, defines a loop's items or signs off is never offered (see deferral.js; the server refuses
 * it too), and a conditional one only while its condition holds.
 * @param {{id?: string, type?: string, loopSource?: unknown} | null | undefined} question
 * @param {{ answered: boolean, locked: boolean, hasReport: boolean, editing: boolean, answers?: Record<string, any> }} ctx
 */
export function canAnswerLater(question, { answered, locked, hasReport, editing, answers }) {
  if (!question || !hasReport || locked || answered || editing) return false;
  if (question.type === 'info' || question.loopSource) return false;
  if (answers && question.id) return deferStatus(question.id, answers).ok;
  return true;
}

/**
 * Why a question cannot be left for later, in the user's language ('' when it can, or when the reason is
 * simply that it is answered already / not on the route).
 * @param {string | undefined} id
 * @param {Record<string, any>} answers
 * @param {boolean} tr  true = Turkish UI
 */
export function deferralReason(id, answers, tr) {
  if (!id) return '';
  const st = deferStatus(id, answers || {});
  if (st.ok || st.code === 'already_answered' || st.code === 'not_applicable' || st.code === 'unknown' || st.code === 'info') return '';
  const copy = /** @type {Record<string, string>} */ (deferralCopy(tr));
  return copy[st.code] || copy.gate;
}

/**
 * The pending ids still to show (unique, unanswered, and still on the questionnaire's route: one the
 * answers have taken off the route is inactive, so it is neither pending nor counted).
 * @param {unknown} ids
 * @param {Record<string, any>} answers
 * @param {(q: any, answers: Record<string, any>, id: string) => boolean} [loopHasItems] the questionnaire's own test
 *   of whether a loop has items (a loop with none is skipped, so a mark on one of its questions is not pending)
 */
export function applicablePending(ids, answers, loopHasItems) {
  return activePending(Array.isArray(ids) ? ids : [], answers || {}, loopHasItems ? { loopHasItems } : undefined);
}
