// @ts-check
// Which parts of the app hold something the user typed but has not submitted. The session guard reads this to word its
// warning honestly. It never saves anything: an answer is saved only when the server confirms it.

/** @type {Map<string, boolean>} */
const sources = new Map();

/**
 * @param {string} source  e.g. 'questionnaire'
 * @param {boolean} dirty
 */
export function setUnsaved(source, dirty) {
  if (dirty) sources.set(source, true); else sources.delete(source);
}

export function hasUnsaved() {
  return sources.size > 0;
}
