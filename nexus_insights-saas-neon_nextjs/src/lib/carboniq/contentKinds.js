// @ts-check
// What a piece of text in the questionnaire IS, so the interface can show it as that and nothing else.
//
//   question     the thing the user has to answer (a question's own text)
//   information  supporting explanation: what the question means, an example, what an answer leads to
//   notification a warning or a status the user should notice (a failed check, a completed inventory)
//   instruction  how to move through the questionnaire (a section's introduction, "review and continue")
//
// Nothing here changes a question, an answer or a route; it only decides how existing text is presented.

/** @typedef {'question' | 'information' | 'notification' | 'instruction'} ContentKind */

export const CONTENT_KINDS = /** @type {const} */ (['question', 'information', 'notification', 'instruction']);

/**
 * The questionnaire's information screens (type: 'info' in questions.js), classified by what they do. A screen
 * that opens a stage tells the user how the next part works: an instruction. A screen that explains a method or
 * announces the finished report is information. A screen not listed here is information (the safe default: a
 * neutral explanation, never a warning). Section pickers are not messages; they are navigation.
 * @type {Record<string, ContentKind>}
 */
export const INFO_SCREEN_KIND = {
  '2A-0': 'instruction',      // Stage 2: Organizational Boundary — what this stage covers
  '3-GİRİŞ': 'instruction',   // Scope 1 introduction
  '4-GİRİŞ': 'instruction',   // Scope 2 introduction
  '6-GİRİŞ': 'instruction',   // Stage 6 introduction
  '7-GİRİŞ': 'instruction',   // Stage 7 introduction
  'D2': 'information',        // the Scope 2 methodology this version supports
  '7A-INFO': 'information',   // the report is ready
  '6B-0': 'information',      // how assumptions are entered
};

/** @param {string | undefined | null} id @returns {ContentKind} */
export function infoScreenKind(id) {
  return (id && INFO_SCREEN_KIND[id]) || 'information';
}

/**
 * A question bubble is written as "question text", a blank line, then "_helper_" (the helper is the explanatory
 * paragraph of the question). Splits the two so they can be shown as different things. Content without that
 * trailing helper is returned whole.
 * @param {unknown} content
 * @returns {{ head: string, helper: string }}
 */
export function splitHelper(content) {
  const text = String(content ?? '');
  const m = text.match(/^([\s\S]*?\S)\n\n_([\s\S]+)_$/);
  if (!m) return { head: text, helper: '' };
  return { head: m[1], helper: m[2] };
}

/**
 * The kind of a chat message: the one it was created with, else what its type implies.
 * @param {{ kind?: string, type?: string, role?: string } | null | undefined} msg
 * @returns {ContentKind | 'error'}
 */
export function messageKind(msg) {
  if (!msg) return 'question';
  if (msg.kind && /** @type {readonly string[]} */ (CONTENT_KINDS).includes(msg.kind)) return /** @type {ContentKind} */ (msg.kind);
  if (msg.type === 'error') return 'error';
  if (msg.type === 'warning') return 'notification';
  if (msg.type === 'info') return 'information';
  return 'question';
}

/**
 * The label that names a kind of content to the user (and to a screen reader).
 * @param {ContentKind | 'error'} kind
 * @param {boolean} tr  true = Turkish UI
 */
export function kindLabel(kind, tr) {
  const en = { question: 'Question', information: 'Information', notification: 'Notice', instruction: 'How this works', error: 'Problem' };
  const trk = { question: 'Soru', information: 'Bilgi', notification: 'Uyarı', instruction: 'Nasıl ilerlenir', error: 'Sorun' };
  return (tr ? trk : en)[kind];
}
