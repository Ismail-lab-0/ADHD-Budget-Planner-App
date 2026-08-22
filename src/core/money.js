// Money utilities. Every monetary amount in this app is stored as a
// non-negative integer number of cents — never a float — so values users
// need to trust exactly are never subject to floating-point drift (e.g.
// 0.1 + 0.2 !== 0.3 in IEEE 754). See docs/DATA-MODEL.md.

/**
 * Parses a user-entered amount (string or number) into non-negative
 * integer cents. Accepts "2450", "2450.5", "2,450.00", "$1,200". Rejects
 * negative amounts, non-numeric input, and more than 2 fractional digits
 * (rather than silently rounding away precision the user typed).
 * @param {string|number} input
 * @returns {number|null} integer cents, or null if not a valid amount
 */
export function parseAmountToCents(input) {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return null;
    return Math.round(input * 100);
  }
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (trimmed === '') return null;

  // Strip currency symbols and thousands separators; keep digits/dot/minus
  // so a leading minus can still be detected and rejected explicitly below
  // (rather than silently stripped, which would turn "-5" into "5").
  const cleaned = trimmed.replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned.startsWith('-')) return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;

  const [wholePart, fractionPart = ''] = cleaned.split('.');
  if (fractionPart.length > 2) return null;

  const wholeCents = BigInt(wholePart || '0') * 100n;
  const fractionCents = BigInt(fractionPart.padEnd(2, '0') || '0');
  const totalCents = wholeCents + fractionCents;

  if (totalCents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(totalCents);
}

/** @param {*} value @returns {boolean} true if a valid stored amount (non-negative integer cents) */
export function isValidAmountCents(value) {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Parses a user-entered balance (string or number) into integer cents,
 * same as parseAmountToCents but permitting a negative result. Only the
 * Current Balance figure uses this — see docs/DATA-MODEL.md "Current
 * Balance model": a balance can legitimately go negative (overdraft-style,
 * or simply having logged more spending than was on hand), and clamping
 * that to $0 would silently misrepresent the user's real position. Every
 * other amount in the app (bills, income, planned expenses, expenses,
 * savings) is a magnitude and must stay non-negative — use
 * parseAmountToCents for those.
 * @param {string|number} input
 * @returns {number|null}
 */
export function parseBalanceToCents(input) {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    return Math.round(input * 100);
  }
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (trimmed === '') return null;

  const isNegative = trimmed.startsWith('-');
  const cleaned = trimmed.replace(/[^0-9.\-]/g, '').replace(/^-/, '');
  if (cleaned === '') return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;

  const [wholePart, fractionPart = ''] = cleaned.split('.');
  if (fractionPart.length > 2) return null;

  const wholeCents = BigInt(wholePart || '0') * 100n;
  const fractionCents = BigInt(fractionPart.padEnd(2, '0') || '0');
  const totalCents = wholeCents + fractionCents;

  if (totalCents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const magnitude = Number(totalCents);
  return isNegative ? -magnitude : magnitude;
}

/** @param {*} value @returns {boolean} true if a valid stored balance (any-sign integer cents) */
export function isValidBalanceCents(value) {
  return Number.isInteger(value);
}

/** @param {number} cents @returns {string} e.g. "$2,450.00" */
export function formatCents(cents) {
  const safe = Number.isFinite(cents) ? cents : 0;
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(Math.round(safe));
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}$${dollars.toLocaleString('en-US')}.${String(remainder).padStart(2, '0')}`;
}

/** @param {number} cents @returns {number} plain dollars, e.g. for pre-filling a form input */
export function centsToDollarString(cents) {
  return (cents / 100).toFixed(2);
}
