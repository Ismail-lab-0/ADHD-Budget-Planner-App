// Tests for src/core/money.js — the integer-cents representation every
// monetary amount in the app uses to avoid floating-point precision
// problems (Phase 2 §9).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmountToCents, isValidAmountCents, formatCents, centsToDollarString, parseBalanceToCents, isValidBalanceCents } from '../../src/core/money.js';

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
