// @ts-check
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
    banner: 'You have unanswered questions in this Inventory.',
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
 * already answered, in an inventory that can still change.
 * @param {{type?: string, loopSource?: unknown} | null | undefined} question
 * @param {{ answered: boolean, locked: boolean, hasReport: boolean, editing: boolean }} ctx
 */
export function canAnswerLater(question, { answered, locked, hasReport, editing }) {
  if (!question || !hasReport || locked || answered || editing) return false;
  if (question.type === 'info' || question.loopSource) return false;
  return true;
}
