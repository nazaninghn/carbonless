// @ts-check
// "What needs my attention in this inventory?" — a read-only overview over the answers the inventory already has,
// computed with the SAME route and policy the server uses (deferral.js / questionnaire/deferral.py). It never
// saves, converts or removes anything: a deferred question stays deferred, an unanswered one stays unanswered.
//
// Four groups, by what the question is NOW:
//   required   on the route, must be answered, and is not (the inventory cannot be completed around it). A question
//              that was deferred before it became required (inventory #34's 2A-1) is listed here, flagged.
//   deferred   on the route, unanswered, marked "I don't know — answer later", and allowed to be (it still blocks
//              completion until it is answered, but it is legitimate to leave it for now).
//   inactive   passed over by the answers (a "no" that skips its follow-ups, a condition that does not hold); not
//              asked, not counted, not pending. An answer saved earlier on such a branch is kept, not used.
//   answered   questions on the route that have an answer (count only).
//
// "Needs attention" lists only questions BEHIND the user's position: those on the route up to the question being
// asked now (or all of them once the inventory is complete). Questions ahead are simply the rest of the
// questionnaire, not something that was missed. At the end of the questionnaire "behind" is the whole route, so the
// two groups are exactly what the server refuses the sign-off for (`required_unanswered` and `pending_questions`).
import { routeIds, policy as POLICY, mustAnswer, effectiveKind } from './deferral.js';

const policy = POLICY.questions;

/**
 * @typedef {{ id: string, status: 'required' | 'deferred', wasDeferred: boolean }} AttentionItem
 * @typedef {{ required: AttentionItem[], deferred: AttentionItem[], inactive: string[], answered: number,
 *             needsAttention: number }} Attention
 */

/**
 * @param {{ answers: Record<string, any>, pendingIds?: unknown, currentId?: string | null, completed?: boolean,
 *           loopHasItems?: (q: any, answers: Record<string, any>, id: string) => boolean }} args
 * @returns {Attention}
 */
export function attentionOverview({ answers, pendingIds, currentId = null, completed = false, loopHasItems }) {
  const src = answers || {};
  const opts = loopHasItems ? { loopHasItems } : {};
  const route = routeIds(src, opts);                              // the full route (past an unanswered gate: its default)
  const confirmed = routeIds(src, { ...opts, confirmed: true });  // up to the first unanswered gate: known to apply
  const marked = new Set(Array.isArray(pendingIds) ? pendingIds.filter(x => typeof x === 'string') : []);

  // Behind the user: the route up to (not including) the question being asked; everything once it is complete.
  const at = completed || !currentId ? -1 : route.indexOf(currentId);
  const behind = new Set(at < 0 ? route : route.slice(0, at));
  const onRoute = new Set(route);

  /** @type {AttentionItem[]} */ const required = [];
  /** @type {AttentionItem[]} */ const deferred = [];
  for (const id of route) {
    const q = policy[id];
    if (!q || q.kind === 'info' || id in src) continue;
    const isMarked = marked.has(id);
    if (q.loop && !isMarked) continue;                // a loop's per-item answers are asked item by item, not listed
    // What the server blocks the sign-off for: a marked question that is still on the route (pending_questions) and
    // a question that must be answered (required_unanswered). How it is shown follows the policy: a marked question
    // the policy allows to be deferred is "answer later" (amber), even if it will have to be answered before
    // completion; one that is required (it was marked before it became required, or never could have been) is red
    // and flagged. A question that was not marked is listed once the user has moved past it.
    if (isMarked) {
      if (effectiveKind(q) === 'required') required.push({ id, status: 'required', wasDeferred: true });
      else deferred.push({ id, status: 'deferred', wasDeferred: true });
    } else if (behind.has(id) && mustAnswer(q, src)) {
      required.push({ id, status: 'required', wasDeferred: false });
    }
  }

  // Inactive: before the furthest known question of the route, in the questionnaire's own order, and not on it.
  const order = Object.keys(policy);
  const lastKnown = confirmed.length ? Math.max(...confirmed.map(id => order.indexOf(id))) : -1;
  const inactive = order.filter((id, i) => {
    const q = policy[id];
    return i < lastKnown && !onRoute.has(id) && q.kind !== 'info' && !q.unreachable;
  });

  const answered = route.filter(id => id in src && policy[id] && policy[id].kind !== 'info').length;
  return { required, deferred, inactive, answered, needsAttention: required.length + deferred.length };
}

/**
 * How many of the items are in each stage (for the progress sidebar's status indicators).
 * @param {Attention} overview
 * @param {(id: string) => number | undefined} stageOf
 * @returns {Record<number, { required: number, deferred: number }>}
 */
export function attentionByStage(overview, stageOf) {
  /** @type {Record<number, { required: number, deferred: number }>} */
  const out = {};
  for (const [list, key] of /** @type {const} */ ([[overview.required, 'required'], [overview.deferred, 'deferred']])) {
    for (const item of list) {
      const st = stageOf(item.id);
      if (st == null) continue;
      (out[st] ||= { required: 0, deferred: 0 })[key] += 1;
    }
  }
  return out;
}

/** The copy of the overview, English / Turkish. @param {boolean} tr */
export function attentionCopy(tr) {
  return tr ? {
    title: 'Dikkat gerektiren sorular',
    banner: 'Bu envanterde yanıtlanmamış sorularınız var.',
    count: (/** @type {number} */ n) => `${n} soru bekliyor`,
    requiredHead: 'Yanıt zorunlu',
    deferredHead: 'Sonra yanıtlanacak',
    inactiveHead: 'Yanıtlarınıza göre gerekmeyen sorular',
    requiredBadge: 'Zorunlu — yanıtsız',
    deferredBadge: 'Sonra yanıtla · Yanıtsız',
    inactiveBadge: 'Gerekmiyor',
    wasDeferredNote: 'Bu soru "sonra yanıtla" olarak işaretlenmişti; artık zorunlu, yanıtlanması gerekiyor.',
    requiredHint: 'Envanter tamamlanmadan önce yanıtlanmalı.',
    deferredHint: 'Bilerek yanıtsız bırakıldı. Envanteri tamamlamadan önce yanıtlanmalı.',
    inactiveHint: 'Önceki yanıtlarınız nedeniyle sorulmuyor; daha önce kaydedilmiş bir yanıt varsa korunur.',
    goTo: 'Soruya dön',
    question: 'Soru',
    answeredCount: (/** @type {number} */ n) => `${n} soru yanıtlandı`,
    sidebarRequired: (/** @type {number} */ n) => `${n} zorunlu`,
    sidebarDeferred: (/** @type {number} */ n) => `${n} sonra`,
    sidebarInactive: (/** @type {number} */ n) => `Gerekmeyen sorular (${n})`,
  } : {
    title: 'Questions needing attention',
    banner: 'This inventory has unanswered questions.',
    count: (/** @type {number} */ n) => `${n} question${n === 1 ? '' : 's'} waiting`,
    requiredHead: 'Required — answer needed',
    deferredHead: 'Marked "answer later"',
    inactiveHead: 'Not needed for your answers',
    requiredBadge: 'Required — unanswered',
    deferredBadge: 'Answer later · Unanswered',
    inactiveBadge: 'Not needed',
    wasDeferredNote: 'This question was marked "answer later"; it is required now and must be answered.',
    requiredHint: 'Must be answered before the inventory can be completed.',
    deferredHint: 'Left unanswered on purpose. It must still be answered before the inventory is completed.',
    inactiveHint: 'Not asked because of your earlier answers; an answer saved earlier is kept.',
    goTo: 'Return to question',
    question: 'Question',
    answeredCount: (/** @type {number} */ n) => `${n} question${n === 1 ? '' : 's'} answered`,
    sidebarRequired: (/** @type {number} */ n) => `${n} required`,
    sidebarDeferred: (/** @type {number} */ n) => `${n} later`,
    sidebarInactive: (/** @type {number} */ n) => `Not needed (${n})`,
  };
}
