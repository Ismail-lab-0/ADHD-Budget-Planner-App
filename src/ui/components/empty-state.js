// A small, reusable empty-state message. See CLAUDE.md's product
// discipline notes — an empty state should say plainly what's true
// ("Nothing planned yet.") rather than leave a blank gap or overstate.

import { el } from '../dom.js';

/** @param {string} message @returns {HTMLElement} */
export function emptyState(message) {
  return el('p', { class: 'empty-state' }, message);
}
