// Tests for src/core/money.js — the integer-cents representation every
// monetary amount in the app uses to avoid floating-point precision
// problems (Phase 2 §9).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAmountToCents,
  isValidAmountCents,
  formatCents,
  centsToDollarString,
  parseBalanceToCents,
  isValidBalanceCents,
  SUPPORTED_CURRENCIES,
  setActiveCurrency,
  getActiveCurrency,
  getCurrencySymbol,
} from '../../src/core/money.js';

describe('parseAmountToCents', () => {
  test('a whole-dollar string parses correctly', () => {
    assert.equal(parseAmountToCents('2450'), 245000);
  });

  test('decimal amounts parse to the exact cent, no float drift', () => {
    assert.equal(parseAmountToCents('2450.50'), 245050);
    assert.equal(parseAmountToCents('0.1'), 10);
    assert.equal(parseAmountToCents('0.2'), 20);
    // The classic float footgun (0.1 + 0.2 !== 0.3 in IEEE 754) — verifying
    // cent-integer addition doesn't inherit it:
    assert.equal(parseAmountToCents('0.1') + parseAmountToCents('0.2'), 30);
  });

  test('a single fractional digit is padded to the cent', () => {
    assert.equal(parseAmountToCents('10.5'), 1050);
  });

  test('currency symbols and thousands separators are accepted', () => {
    assert.equal(parseAmountToCents('$1,200.00'), 120000);
    assert.equal(parseAmountToCents('2,450.00'), 245000);
  });

  test('a numeric input is accepted directly', () => {
    assert.equal(parseAmountToCents(150), 15000);
    assert.equal(parseAmountToCents(19.99), 1999);
  });

  test('zero is a valid amount', () => {
    assert.equal(parseAmountToCents('0'), 0);
    assert.equal(parseAmountToCents(0), 0);
  });

  test('negative input is rejected', () => {
    assert.equal(parseAmountToCents('-5'), null);
    assert.equal(parseAmountToCents(-5), null);
    assert.equal(parseAmountToCents('-$5.00'), null);
  });

  test('non-numeric / empty / garbage input is rejected', () => {
    assert.equal(parseAmountToCents(''), null);
    assert.equal(parseAmountToCents('   '), null);
    assert.equal(parseAmountToCents('abc'), null);
    assert.equal(parseAmountToCents('12.34.56'), null);
    assert.equal(parseAmountToCents(NaN), null);
    assert.equal(parseAmountToCents(Infinity), null);
    assert.equal(parseAmountToCents(undefined), null);
    assert.equal(parseAmountToCents(null), null);
  });

  test('more than 2 fractional digits is rejected rather than silently rounded', () => {
    assert.equal(parseAmountToCents('1.005'), null);
  });
});

describe('isValidAmountCents', () => {
  test('a non-negative integer is valid', () => {
    assert.ok(isValidAmountCents(0));
    assert.ok(isValidAmountCents(245000));
  });

  test('a float, a negative number, or a non-number is invalid', () => {
    assert.equal(isValidAmountCents(10.5), false);
    assert.equal(isValidAmountCents(-100), false);
    assert.equal(isValidAmountCents('100'), false);
    assert.equal(isValidAmountCents(null), false);
    assert.equal(isValidAmountCents(undefined), false);
  });
});

describe('formatCents', () => {
  test('formats whole and fractional cents with thousands separators', () => {
    assert.equal(formatCents(245000), '$2,450.00');
    assert.equal(formatCents(245050), '$2,450.50');
    assert.equal(formatCents(0), '$0.00');
    assert.equal(formatCents(5), '$0.05');
  });

  test('a negative amount keeps the sign before the currency symbol', () => {
    assert.equal(formatCents(-4000), '-$40.00');
  });

  test('a non-finite value is treated as 0 rather than producing "NaN"', () => {
    assert.equal(formatCents(NaN), '$0.00');
    assert.equal(formatCents(undefined), '$0.00');
  });
});

// Multi-currency (display preference only — see money.js's own
// SUPPORTED_CURRENCIES comment): `setActiveCurrency` is module-level
// state read implicitly by `formatCents`, same mechanism src/ui/shell.js
// uses once per render. Every test here restores 'USD' before returning
// (not just at file end) so no currency choice leaks into a test defined
// after it in this same file/process, regardless of run order.
describe('SUPPORTED_CURRENCIES / setActiveCurrency / getActiveCurrency / formatCents (multi-currency display)', () => {
  test('defaults to USD before any setActiveCurrency call', () => {
    assert.equal(getActiveCurrency(), 'USD');
  });

  test('SUPPORTED_CURRENCIES includes USD and is a non-empty, deduplicated-looking list', () => {
    assert.ok(SUPPORTED_CURRENCIES.includes('USD'));
    assert.equal(new Set(SUPPORTED_CURRENCIES).size, SUPPORTED_CURRENCIES.length);
  });

  test('formatCents renders the same stored number in whichever currency is active — no conversion, just a different symbol/format', () => {
    setActiveCurrency('EUR');
    assert.equal(getActiveCurrency(), 'EUR');
    assert.equal(formatCents(245000), '€2,450.00');
    setActiveCurrency('USD');
  });

  test('a currency with no minor unit (JPY) formats with no decimal places', () => {
    setActiveCurrency('JPY');
    assert.equal(formatCents(245000), '¥2,450');
    setActiveCurrency('USD');
  });

  test('an unrecognized/corrupted currency code falls back to USD rather than throwing', () => {
    setActiveCurrency('NOT_A_REAL_CODE');
    assert.equal(getActiveCurrency(), 'USD');
    assert.equal(formatCents(245000), '$2,450.00');
  });
});

describe('getCurrencySymbol (the currency picker\'s icon-button glyph — src/ui/components/currency-selector.js)', () => {
  test('returns the bare symbol for each supported currency', () => {
    assert.equal(getCurrencySymbol('USD'), '$');
    assert.equal(getCurrencySymbol('EUR'), '€');
    assert.equal(getCurrencySymbol('GBP'), '£');
    assert.equal(getCurrencySymbol('JPY'), '¥');
  });

  test('CAD/AUD render as a plain "$", not disambiguated (e.g. "CA$") — narrowSymbol, not the default symbol style', () => {
    assert.equal(getCurrencySymbol('CAD'), '$');
    assert.equal(getCurrencySymbol('AUD'), '$');
  });

  test('an unrecognized/corrupted code falls back to the default currency\'s symbol rather than throwing', () => {
    assert.equal(getCurrencySymbol('NOT_A_REAL_CODE'), '$');
  });

  test('is independent of setActiveCurrency — always reflects the code passed in, not the active one', () => {
    setActiveCurrency('JPY');
    assert.equal(getCurrencySymbol('EUR'), '€');
    setActiveCurrency('USD');
  });
});

describe('centsToDollarString', () => {
  test('round-trips through parseAmountToCents', () => {
    assert.equal(centsToDollarString(245050), '2450.50');
    assert.equal(parseAmountToCents(centsToDollarString(245050)), 245050);
  });

  test('preserves a negative sign for balances (see docs/DATA-MODEL.md "Current Balance model")', () => {
    assert.equal(centsToDollarString(-4000), '-40.00');
  });
});

describe('parseBalanceToCents (Phase 5 — Current Balance may be negative, unlike every other amount)', () => {
  test('accepts a negative amount', () => {
    assert.equal(parseBalanceToCents('-40.00'), -4000);
    assert.equal(parseBalanceToCents(-40), -4000);
  });

  test('still parses positive/zero amounts the same as parseAmountToCents', () => {
    assert.equal(parseBalanceToCents('2450.50'), 245050);
    assert.equal(parseBalanceToCents('0'), 0);
  });

  test('round-trips through centsToDollarString for a negative value', () => {
    assert.equal(parseBalanceToCents(centsToDollarString(-4000)), -4000);
  });

  test('still rejects non-numeric input and more than 2 fractional digits', () => {
    assert.equal(parseBalanceToCents('abc'), null);
    assert.equal(parseBalanceToCents('1.005'), null);
    assert.equal(parseBalanceToCents(''), null);
  });
});

describe('isValidBalanceCents', () => {
  test('any integer is valid, positive, negative, or zero', () => {
    assert.ok(isValidBalanceCents(245000));
    assert.ok(isValidBalanceCents(-4000));
    assert.ok(isValidBalanceCents(0));
  });

  test('a non-integer is invalid', () => {
    assert.equal(isValidBalanceCents(10.5), false);
    assert.equal(isValidBalanceCents('100'), false);
    assert.equal(isValidBalanceCents(null), false);
  });
});
