// Tests for the Income Receipts module — the historical log of confirmed
// income (docs/DATA-MODEL.md "IncomeReceipt"), created automatically
// whenever an Income is marked received (see tests/unit/main.test.js /
// tests/unit/dashboard-integration.test.js for the real cross-slice
// wiring in src/main.js's rootReducer).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createIncomeReceipt, getAllIncomeReceipts, getIncomeReceiptsForPeriod, getIncomeReceiptsTotalCents } from '../../src/modules/income-receipts/index.js';

const NOW = new Date(2026, 7, 21, 9, 0); // Friday, August 21, 2026, 9am

describe('createIncomeReceipt', () => {
  test('builds a receipt carrying the income\'s amount/name and today\'s date', () => {
    const income = { id: 'inc_1', name: 'Paycheck', amountCents: 250000 };
    const receipt = createIncomeReceipt(income, NOW);
    assert.equal(receipt.incomeId, 'inc_1');
    assert.equal(receipt.name, 'Paycheck');
    assert.equal(receipt.amountCents, 250000);
    assert.equal(receipt.date, '2026-08-21');
    assert.equal(receipt.createdAt, NOW.toISOString());
    assert.ok(receipt.id.startsWith('ir_'));
  });

  test('two receipts created back to back get distinct ids', () => {
    const income = { id: 'inc_1', name: 'Paycheck', amountCents: 250000 };
    const r1 = createIncomeReceipt(income, NOW);
    const r2 = createIncomeReceipt(income, NOW);
    assert.notEqual(r1.id, r2.id);
  });

  test('a missing income produces no receipt', () => {
    assert.equal(createIncomeReceipt(undefined, NOW), null);
    assert.equal(createIncomeReceipt(null, NOW), null);
  });

  test('a corrupted amountCents (hand-edited/pre-validation localStorage data) produces no receipt, not a NaN one', () => {
    assert.equal(createIncomeReceipt({ id: 'inc_1', name: 'x', amountCents: 'bad' }, NOW), null);
    assert.equal(createIncomeReceipt({ id: 'inc_1', name: 'x', amountCents: -100 }, NOW), null);
  });
});

describe('getAllIncomeReceipts', () => {
  test('reads the stored collection', () => {
    const receipts = [{ id: 'ir1' }];
    assert.equal(getAllIncomeReceipts({ incomeReceipts: receipts }), receipts);
  });

  test('tolerates a missing or corrupted collection, returning []', () => {
    assert.deepEqual(getAllIncomeReceipts({}), []);
    assert.deepEqual(getAllIncomeReceipts({ incomeReceipts: 'not an array' }), []);
  });
});

describe('getIncomeReceiptsForPeriod', () => {
  const state = {
    incomeReceipts: [
      { id: 'ir1', amountCents: 1000, date: '2026-07-15' },
      { id: 'ir2', amountCents: 2000, date: '2026-08-01' },
      { id: 'ir3', amountCents: 3000, date: '2026-08-21' },
      { id: 'ir4', amountCents: 4000, date: '2026-09-01' },
    ],
  };

  test('filters to an inclusive [startDateKey, endDateKey] range', () => {
    const result = getIncomeReceiptsForPeriod(state, { startDateKey: '2026-08-01', endDateKey: '2026-08-31' });
    assert.deepEqual(result.map((r) => r.id), ['ir2', 'ir3']);
  });

  test('an unbounded end (null) includes everything on/after the start', () => {
    const result = getIncomeReceiptsForPeriod(state, { startDateKey: '2026-08-01', endDateKey: null });
    assert.deepEqual(result.map((r) => r.id), ['ir2', 'ir3', 'ir4']);
  });

  test('no bounds at all returns every receipt', () => {
    const result = getIncomeReceiptsForPeriod(state, {});
    assert.equal(result.length, 4);
  });

  test('a receipt with no date is excluded from any bounded query', () => {
    const result = getIncomeReceiptsForPeriod({ incomeReceipts: [{ id: 'ir1', amountCents: 100, date: null }] }, { startDateKey: '2026-01-01' });
    assert.deepEqual(result, []);
  });
});

describe('getIncomeReceiptsTotalCents', () => {
  test('sums amounts across a list', () => {
    assert.equal(getIncomeReceiptsTotalCents([{ amountCents: 500 }, { amountCents: 1250 }]), 1750);
  });

  test('is 0 for an empty list', () => {
    assert.equal(getIncomeReceiptsTotalCents([]), 0);
  });

  test('skips a corrupted amountCents rather than NaN-poisoning the total', () => {
    assert.equal(getIncomeReceiptsTotalCents([{ amountCents: 500 }, { amountCents: 'bad' }, { amountCents: -100 }]), 500);
  });

  test('tolerates a non-array input, returning 0', () => {
    assert.equal(getIncomeReceiptsTotalCents(null), 0);
    assert.equal(getIncomeReceiptsTotalCents(undefined), 0);
  });
});
