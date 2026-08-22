// Tests for the Safe-to-Spend calculation engine. See
// docs/SAFE-TO-SPEND.md for the full formula this verifies. Every test
// uses a fixed `now` — never the real current date — per Phase 3's
// explicit testing requirement.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getSafeToSpend, getSpendingAllowance, getSafeToSpendMessage, SAFE_TO_SPEND_LABEL, PLANNING_DISCLAIMER } from '../../src/modules/safe-to-spend/index.js';

const NOW = new Date(2026, 7, 21); // Friday, Aug 21 2026 — fixed, arbitrary

function baseState(overrides = {}) {
  return {
    budget: { currentBalanceCents: 0, savingsAllocationCents: 0 },
    incomes: [],
    bills: [],
    plannedExpenses: [],
    ...overrides,
  };
}

function income(overrides = {}) {
  return { id: 'i1', active: true, frequency: 'one-time', nextDate: '2026-09-01', ...overrides };
}

function bill(overrides = {}) {
  return { id: 'b1', active: true, paid: false, amountCents: 0, dueDate: '2026-08-25', recurrence: 'one-time', ...overrides };
}

function plannedExpense(overrides = {}) {
  return { id: 'p1', amountCents: 0, plannedDate: '2026-08-25', ...overrides };
}

describe('1. no commitments', () => {
  test('Safe-to-Spend equals the current balance exactly', () => {
    const state = baseState({ budget: { currentBalanceCents: 100000, savingsAllocationCents: 0 } });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.safeToSpendCents, 100000);
    assert.equal(result.upcomingBillsCents, 0);
    assert.equal(result.plannedExpensesCents, 0);
    assert.equal(result.isNegative, false);
  });
});

describe('2. bills only', () => {
  test('does not subtract an unpaid bill — bills only reduce Safe-to-Spend once marked paid (see §2/§6)', () => {
    const state = baseState({
      budget: { currentBalanceCents: 100000, savingsAllocationCents: 0 },
      bills: [bill({ amountCents: 30000 })],
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.upcomingBillsCents, 30000); // still computed, display-only
    assert.equal(result.safeToSpendCents, 100000); // unaffected until paid
  });
});

describe('3. planned expenses only', () => {
  test('subtracts the planned expense amount', () => {
    const state = baseState({
      budget: { currentBalanceCents: 100000, savingsAllocationCents: 0 },
      plannedExpenses: [plannedExpense({ amountCents: 15000 })],
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.plannedExpensesCents, 15000);
    assert.equal(result.safeToSpendCents, 85000);
  });
});

describe('4. savings only', () => {
  test('subtracts the savings allocation', () => {
    const state = baseState({ budget: { currentBalanceCents: 100000, savingsAllocationCents: 20000 } });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.savingsAllocationCents, 20000);
    assert.equal(result.safeToSpendCents, 80000);
  });
});

// 5. Safety buffer — removed at the user's request (docs/SAFE-TO-SPEND.md
// §9); the numbering below is left as-is rather than renumbered, since the
// numbers are just organizational labels, not references anything else
// depends on.

describe('6. income before payday (income never adds to the balance)', () => {
  test('an income source due soon sets the horizon but contributes $0 to Safe-to-Spend', () => {
    const state = baseState({
      budget: { currentBalanceCents: 50000, savingsAllocationCents: 0 },
      incomes: [income({ nextDate: '2026-08-24', amountCents: 999999 })], // amountCents ignored by design
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.nextPaydayDate, '2026-08-24');
    assert.equal(result.daysUntilPayday, 3);
    assert.equal(result.safeToSpendCents, 50000); // unaffected by the income amount
  });
});

describe('upcomingIncomeCents (display-only, never part of the arithmetic)', () => {
  test('reports the amount of income landing on the horizon date', () => {
    const state = baseState({
      budget: { currentBalanceCents: 50000, savingsAllocationCents: 0 },
      incomes: [income({ nextDate: '2026-08-24', amountCents: 200000 })],
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.upcomingIncomeCents, 200000);
    assert.equal(result.safeToSpendCents, 50000); // still excluded from the math
  });

  test('sums multiple income sources tied for the earliest date', () => {
    const state = baseState({
      budget: { currentBalanceCents: 0, savingsAllocationCents: 0 },
      incomes: [
        income({ id: 'a', nextDate: '2026-08-24', amountCents: 100000 }),
        income({ id: 'b', nextDate: '2026-08-24', amountCents: 50000 }),
        income({ id: 'c', nextDate: '2026-09-01', amountCents: 999999 }), // later — excluded
      ],
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.upcomingIncomeCents, 150000);
  });

  test('is 0 when there is no determinable payday', () => {
    const result = getSafeToSpend(baseState(), { now: NOW });
    assert.equal(result.upcomingIncomeCents, 0);
  });
});

describe('7. income after payday (a later income never becomes the horizon)', () => {
  test('the earliest income wins; a later one is irrelevant to the horizon and never added', () => {
    const state = baseState({
      budget: { currentBalanceCents: 50000, savingsAllocationCents: 0 },
      incomes: [income({ id: 'soon', nextDate: '2026-08-24' }), income({ id: 'later', nextDate: '2026-09-15' })],
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.nextPaydayDate, '2026-08-24');
    assert.equal(result.daysUntilPayday, 3);
    assert.equal(result.safeToSpendCents, 50000);
  });
});

describe('8. multiple upcoming bills', () => {
  test('upcomingBillsCents sums every active, unpaid bill within the horizon, but none of it is subtracted', () => {
    const state = baseState({
      budget: { currentBalanceCents: 200000, savingsAllocationCents: 0 },
      bills: [bill({ id: 'b1', amountCents: 30000, dueDate: '2026-08-22' }), bill({ id: 'b2', amountCents: 45000, dueDate: '2026-08-23' })],
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.upcomingBillsCents, 75000);
    assert.equal(result.safeToSpendCents, 200000);
  });
});

describe('9. recurring income', () => {
  test('a stale recurring income rolls forward to determine the horizon', () => {
    const state = baseState({
      budget: { currentBalanceCents: 50000, savingsAllocationCents: 0 },
      incomes: [income({ nextDate: '2026-07-21', frequency: 'monthly' })], // a month before NOW
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.nextPaydayDate, '2026-08-21'); // rolled forward to today
    assert.equal(result.daysUntilPayday, 0);
  });
});

describe('10. recurring bills', () => {
  test('a stale recurring bill rolls forward and still counts if the new date is within the horizon', () => {
    const state = baseState({
      budget: { currentBalanceCents: 100000, savingsAllocationCents: 0 },
      incomes: [income({ nextDate: '2026-08-30', frequency: 'one-time' })],
      bills: [bill({ amountCents: 40000, dueDate: '2026-07-21', recurrence: 'monthly' })], // rolls to 2026-08-21
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.upcomingBillsCents, 40000); // 2026-08-21 <= horizon 2026-08-30 — still counted for display
    assert.equal(result.safeToSpendCents, 100000); // unaffected — unpaid bills don't subtract
  });

  test('a monthly bill rolled forward beyond a tight horizon is excluded', () => {
    const state = baseState({
      budget: { currentBalanceCents: 100000, savingsAllocationCents: 0 },
      incomes: [income({ nextDate: '2026-08-21', frequency: 'one-time' })], // horizon = today
      bills: [bill({ amountCents: 40000, dueDate: '2026-06-25', recurrence: 'monthly' })], // rolls to 2026-08-25, after the horizon
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.upcomingBillsCents, 0);
    assert.equal(result.safeToSpendCents, 100000);
  });
});

describe('11. paid bill', () => {
  test('a paid bill is excluded entirely, regardless of due date', () => {
    const state = baseState({
      budget: { currentBalanceCents: 100000, savingsAllocationCents: 0 },
      bills: [bill({ amountCents: 40000, dueDate: '2026-08-01', paid: true })], // overdue but paid
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.upcomingBillsCents, 0);
    assert.equal(result.safeToSpendCents, 100000);
  });

  test('an inactive bill is also excluded', () => {
    const state = baseState({
      budget: { currentBalanceCents: 100000, savingsAllocationCents: 0 },
      bills: [bill({ amountCents: 40000, active: false })],
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.upcomingBillsCents, 0);
  });
});

// These next few sections deliberately drive the result negative/zero/
// decimal via planned expenses rather than bills — as of the "bills only
// reduce Safe-to-Spend once marked paid" change (§2/§6), an unpaid bill
// can no longer push the number down at all, so it can't stand in for
// "a commitment that subtracts" here anymore. Planned expenses still
// subtract unconditionally, so they exercise the same negative/zero/
// decimal contract this section is actually about.
describe('12. negative Safe-to-Spend', () => {
  test('commitments exceeding the balance produce a true negative result, not clamped to zero', () => {
    const state = baseState({
      budget: { currentBalanceCents: 10000, savingsAllocationCents: 0 },
      plannedExpenses: [plannedExpense({ amountCents: 50000 })],
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.safeToSpendCents, -40000);
    assert.equal(result.isNegative, true);
  });

  test('getSafeToSpendMessage returns neutral, non-judgmental copy stating the overage', () => {
    const state = baseState({
      budget: { currentBalanceCents: 10000, savingsAllocationCents: 0 },
      plannedExpenses: [plannedExpense({ amountCents: 50000 })],
    });
    const result = getSafeToSpend(state, { now: NOW });
    const message = getSafeToSpendMessage(result);
    assert.match(message, /\$400\.00/);
    assert.doesNotMatch(message.toLowerCase(), /you failed|your fault|irresponsible/);
  });
});

describe('13. zero Safe-to-Spend', () => {
  test('an exact-zero result is reported precisely, not as negative', () => {
    const state = baseState({
      budget: { currentBalanceCents: 50000, savingsAllocationCents: 0 },
      plannedExpenses: [plannedExpense({ amountCents: 50000 })],
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.safeToSpendCents, 0);
    assert.equal(result.isNegative, false);
    assert.match(getSafeToSpendMessage(result), /already committed/);
  });
});

describe('14. decimal amounts', () => {
  test('cent-level arithmetic is exact, no floating-point drift', () => {
    const state = baseState({
      budget: { currentBalanceCents: 10, savingsAllocationCents: 0 }, // $0.10
      plannedExpenses: [plannedExpense({ amountCents: 20 })], // -$0.20
    });
    // $0.10 - $0.20 in naive float math risks drift; in integer cents it's exact.
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.safeToSpendCents, -10);
  });

  test('a realistic decimal scenario matches hand-calculated cents exactly', () => {
    const state = baseState({
      budget: { currentBalanceCents: 245099, savingsAllocationCents: 12345 }, // $2450.99, $123.45
      plannedExpenses: [plannedExpense({ amountCents: 9999 })], // $99.99
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.safeToSpendCents, 245099 - 9999 - 12345);
  });
});

describe('15. multiple income sources', () => {
  test('the earliest active income determines the horizon, regardless of how many exist', () => {
    const state = baseState({
      budget: { currentBalanceCents: 50000, savingsAllocationCents: 0 },
      incomes: [
        income({ id: 'a', nextDate: '2026-09-10' }),
        income({ id: 'b', nextDate: '2026-08-23' }),
        income({ id: 'c', nextDate: '2026-08-30' }),
        income({ id: 'inactive', nextDate: '2026-08-22', active: false }), // would be earliest, but inactive
      ],
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.nextPaydayDate, '2026-08-23');
    assert.equal(result.daysUntilPayday, 2);
  });
});

describe('16. multiple expense sources', () => {
  test('multiple planned expenses within the horizon are all summed', () => {
    const state = baseState({
      budget: { currentBalanceCents: 200000, savingsAllocationCents: 0 },
      plannedExpenses: [
        plannedExpense({ id: 'p1', amountCents: 10000, plannedDate: '2026-08-22' }),
        plannedExpense({ id: 'p2', amountCents: 25000, plannedDate: '2026-08-24' }),
      ],
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.plannedExpensesCents, 35000);
    assert.equal(result.safeToSpendCents, 165000);
  });

  test('bills contribute $0 to the arithmetic (display-only); only planned expenses subtract', () => {
    const state = baseState({
      budget: { currentBalanceCents: 300000, savingsAllocationCents: 0 },
      bills: [bill({ amountCents: 50000 })],
      plannedExpenses: [plannedExpense({ amountCents: 25000 })],
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.upcomingBillsCents, 50000); // display-only
    assert.equal(result.safeToSpendCents, 275000); // 300000 - 25000; the bill is excluded until paid
  });
});

describe('16a. totalCommittedCents (display-only, see docs/SAFE-TO-SPEND.md §11b)', () => {
  test('is the exact sum of planned expenses + savings — bills are excluded (§2/§6)', () => {
    const state = baseState({
      budget: { currentBalanceCents: 300000, savingsAllocationCents: 20000 },
      bills: [bill({ amountCents: 50000 })],
      plannedExpenses: [plannedExpense({ amountCents: 25000 })],
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.totalCommittedCents, 25000 + 20000);
    assert.equal(result.currentBalanceCents - result.totalCommittedCents, result.safeToSpendCents);
  });

  test('is zero when nothing is committed', () => {
    const state = baseState({ budget: { currentBalanceCents: 100000, savingsAllocationCents: 0 } });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.totalCommittedCents, 0);
  });
});

describe('17. same-day payday', () => {
  test('daysUntilPayday is 0, and the daily allowance is the full amount (not divided by zero)', () => {
    const state = baseState({
      budget: { currentBalanceCents: 30000, savingsAllocationCents: 0 },
      incomes: [income({ nextDate: '2026-08-21' })], // today
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.daysUntilPayday, 0);
    assert.equal(result.dailyAllowanceCents, 30000);
    assert.equal(getSpendingAllowance(state, { now: NOW }), 30000);
  });
});

describe('18. missing optional values', () => {
  test('a completely empty state object does not throw and yields a zeroed result', () => {
    assert.doesNotThrow(() => getSafeToSpend({}, { now: NOW }));
    const result = getSafeToSpend({}, { now: NOW });
    assert.equal(result.safeToSpendCents, 0);
    assert.equal(result.nextPaydayDate, null);
    assert.equal(result.daysUntilPayday, null);
    assert.equal(result.dailyAllowanceCents, null);
  });

  test('missing budget/incomes/bills/plannedExpenses arrays individually do not throw', () => {
    assert.doesNotThrow(() => getSafeToSpend({ budget: { currentBalanceCents: 1000 } }, { now: NOW }));
    assert.doesNotThrow(() => getSafeToSpend({ incomes: undefined, bills: undefined, plannedExpenses: undefined }, { now: NOW }));
  });

  test('a bill with no dueDate is conservatively always included', () => {
    const state = baseState({
      budget: { currentBalanceCents: 100000, savingsAllocationCents: 0 },
      bills: [bill({ amountCents: 20000, dueDate: null })],
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.upcomingBillsCents, 20000);
  });

  test('a planned expense with no plannedDate is conservatively always included', () => {
    const state = baseState({
      budget: { currentBalanceCents: 100000, savingsAllocationCents: 0 },
      plannedExpenses: [plannedExpense({ amountCents: 20000, plannedDate: null })],
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.plannedExpensesCents, 20000);
  });

  test('an invalid amountCents on a bill is skipped rather than corrupting the sum', () => {
    const state = baseState({
      budget: { currentBalanceCents: 100000, savingsAllocationCents: 0 },
      bills: [bill({ amountCents: -500 }), bill({ id: 'b2', amountCents: 10000 })],
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.upcomingBillsCents, 10000);
  });
});

describe('no active income at all -> unbounded horizon (conservative default)', () => {
  test('every unpaid bill and planned expense is still recognized regardless of date, but only planned expenses actually subtract', () => {
    const state = baseState({
      budget: { currentBalanceCents: 500000, savingsAllocationCents: 0 },
      bills: [bill({ amountCents: 10000, dueDate: '2027-06-01' })], // far in the future
      plannedExpenses: [plannedExpense({ amountCents: 5000, plannedDate: '2028-01-01' })], // even further
    });
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.nextPaydayDate, null);
    assert.equal(result.upcomingBillsCents, 10000); // display-only
    assert.equal(result.plannedExpensesCents, 5000);
    assert.equal(result.safeToSpendCents, 495000); // 500000 - 5000; the bill is excluded until paid
  });
});

describe('product wording', () => {
  test('the label is always framed as an estimate, never a definite claim', () => {
    assert.equal(SAFE_TO_SPEND_LABEL, 'Estimated safe to spend');
  });

  test('the planning disclaimer states the app does not connect to or verify bank accounts', () => {
    assert.match(PLANNING_DISCLAIMER.toLowerCase(), /doesn't connect to or verify/);
  });

  test('an ordinary positive result gets no extra message (the number speaks for itself)', () => {
    const result = getSafeToSpend(baseState({ budget: { currentBalanceCents: 50000, savingsAllocationCents: 0 } }), { now: NOW });
    assert.equal(getSafeToSpendMessage(result), null);
  });
});

describe('cross-check against docs/PRODUCT.md §6 illustrative example', () => {
  test('reproduces the documented example exactly', () => {
    const state = {
      budget: { currentBalanceCents: 245000, savingsAllocationCents: 20000 },
      incomes: [income({ nextDate: '2026-09-01', frequency: 'monthly' })],
      bills: [bill({ amountCents: 120000, dueDate: '2026-08-25' })],
      plannedExpenses: [plannedExpense({ amountCents: 30000, plannedDate: '2026-08-28' })],
    };
    const result = getSafeToSpend(state, { now: NOW });
    assert.equal(result.currentBalanceCents, 245000);
    assert.equal(result.upcomingBillsCents, 120000); // display-only, not subtracted until paid
    assert.equal(result.plannedExpensesCents, 30000);
    assert.equal(result.savingsAllocationCents, 20000);
    assert.equal(result.safeToSpendCents, 195000); // matches the documented $1,950 — bills excluded until paid
  });
});
