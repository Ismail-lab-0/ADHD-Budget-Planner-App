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

// ISO 4217 codes offered by the currency picker (src/ui/components/
// currency-selector.js) — a deliberately short, common list, not
// exhaustive; adding another is a one-line change here. This is purely a
// *display* preference (docs/DATA-MODEL.md "Settings" — `settings.currency`)
// — every stored amount stays exactly what it always was, one plain
// integer-cents number, with no conversion, no exchange rates, and no
// per-entry currency. Switching currencies only changes the symbol/
// punctuation `formatCents` renders the same number with (see
// `setActiveCurrency` below) — $2,450.00 and €2,450.00 represent the
// identical stored value, deliberately not two different amounts.
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];
const DEFAULT_CURRENCY = 'USD';

// The currency `formatCents` renders amounts in — set once per render
// from the stored `settings.currency` (src/ui/shell.js's `render()`),
// mirroring exactly how the stored theme preference is applied to
// `<html>` once per render rather than threaded as a prop through every
// component that needs it (see base.css's own theme comment). A
// deliberate, narrow exception to this module's otherwise pure-function
// design: `formatCents` is called from roughly a dozen UI files, several
// through nested row-building helpers that don't currently receive
// `state` at all — threading a currency argument through every one of
// them would be a much larger, riskier change for a display-only
// preference than reusing the "set once at the top of a render pass, read
// implicitly for its duration" pattern this app already relies on for
// theme. Safe because every render is fully synchronous, top-to-bottom
// DOM construction (docs/ARCHITECTURE.md) — there is no interleaving that
// could let one render's `formatCents` calls see a different render's
// active currency.
let activeCurrency = DEFAULT_CURRENCY;

/**
 * @param {string} currency an ISO 4217 code, ideally from
 *   `SUPPORTED_CURRENCIES` — anything else (a corrupted stored value, an
 *   unrecognized code) falls back to the default rather than risking a
 *   thrown `Intl.NumberFormat` call blanking the whole dashboard.
 */
export function setActiveCurrency(currency) {
  activeCurrency = SUPPORTED_CURRENCIES.includes(currency) ? currency : DEFAULT_CURRENCY;
}

/** @returns {string} the currency `formatCents` is currently rendering amounts in. */
export function getActiveCurrency() {
  return activeCurrency;
}

/**
 * The bare symbol for a currency code (e.g. "$", "€", "£", "¥") — used by
 * the currency picker's icon button (src/ui/components/
 * currency-selector.js), which shows the sign itself rather than the
 * 3-letter code. Derived from `Intl.NumberFormat` (`narrowSymbol` —
 * plain "$" rather than e.g. "CA$" for CAD, which `Intl`'s default
 * `symbol` style would disambiguate with) instead of a second hardcoded
 * currency->symbol map, so this and `formatCents` can never disagree
 * about what a given code renders as.
 * @param {string} currency an ISO 4217 code, ideally from
 *   `SUPPORTED_CURRENCIES` — falls back to the default currency's symbol
 *   for anything else, same "never throw" contract as `formatCents`.
 * @returns {string}
 */
export function getCurrencySymbol(currency) {
  const code = SUPPORTED_CURRENCIES.includes(currency) ? currency : DEFAULT_CURRENCY;
  try {
    const part = new Intl.NumberFormat('en-US', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value ?? code;
  } catch {
    return code;
  }
}

/**
 * @param {number} cents
 * @returns {string} e.g. "$2,450.00" in the active currency (see
 *   `setActiveCurrency`) — locale fixed at `en-US` (thousands/decimal
 *   punctuation, symbol placement) regardless of the browser's own
 *   locale, so output stays deterministic and matches this app's existing
 *   number formatting everywhere else, independent of which currency is
 *   selected. `Intl.NumberFormat` handles each currency's real minor-unit
 *   convention correctly on its own (e.g. JPY has no decimal places) —
 *   this file doesn't hardcode that per currency.
 */
export function formatCents(cents) {
  const safe = Number.isFinite(cents) ? cents : 0;
  const rounded = Math.round(safe);
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: activeCurrency }).format(rounded / 100);
  } catch {
    // activeCurrency is only ever set from SUPPORTED_CURRENCIES via
    // setActiveCurrency, so this should be unreachable — kept as a
    // last-resort fallback rather than letting a formatting call throw.
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: DEFAULT_CURRENCY }).format(rounded / 100);
  }
}

/** @param {number} cents @returns {number} plain dollars, e.g. for pre-filling a form input */
export function centsToDollarString(cents) {
  return (cents / 100).toFixed(2);
}
