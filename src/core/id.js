// Client-side unique id generation. See docs/DATA-MODEL.md §7 — timestamp
// + random suffix is sufficient uniqueness for a single-user, single-device
// app; no UUID library dependency needed.
//
// A monotonic counter is layered on top of the timestamp so uniqueness is
// guaranteed even across many synchronous calls within the same
// millisecond, rather than relying on Math.random() alone to avoid
// collisions.

let lastTimestamp = 0;
let callsAtLastTimestamp = 0;

/**
 * @param {string} [prefix] Short entity-type prefix, e.g. 't' for Task,
 *   'g' for Goal. Omit for a bare id.
 * @returns {string}
 */
export function createId(prefix = '') {
  const timestamp = Date.now();
  if (timestamp === lastTimestamp) {
    callsAtLastTimestamp += 1;
  } else {
    lastTimestamp = timestamp;
    callsAtLastTimestamp = 0;
  }

  const random = Math.random().toString(36).slice(2, 8);
  const sequence = callsAtLastTimestamp > 0 ? `-${callsAtLastTimestamp.toString(36)}` : '';
  const base = `${timestamp.toString(36)}${sequence}_${random}`;

  return prefix ? `${prefix}_${base}` : base;
}
