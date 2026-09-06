// Dev entry point: wires core services + UI shell together. See
// docs/ARCHITECTURE.md §3 and §6. This file is also the build entry point
// for build/build.js.
//
// `rootReducer` and `initAppState` are exported so the store-wiring logic
// (independent of the DOM) can be unit-tested directly — see
// docs/TEST-PLAN.md §2 ("application initialization", "state
// initialization", "storage save/load", "state persistence after reload").

// Imported first (its exports are used by the UI, not here) so the
// DEMO_MODE build flag lands near the top of the built bundle — see
// src/ui/demo-gate.js and build/build.js's --demo flag.
import { DEMO_MODE } from './ui/demo-gate.js';
import { createStore } from './core/store.js';
import { createEventBus } from './core/events.js';
import { createStorageAdapter } from './core/storage.js';
import { createEmptyState } from './core/schema.js';
import { mountShell } from './ui/shell.js';
import { incomesReducer, computeIncomeBalanceDelta } from './modules/incomes/index.js';
import { createIncomeReceipt } from './modules/income-receipts/index.js';
import { billsReducer, computeBillBalanceDelta } from './modules/bills/index.js';
import { createBillPayment } from './modules/bill-payments/index.js';
import { plannedExpensesReducer } from './modules/planned-expenses/index.js';
import { budgetReducer } from './modules/budget/index.js';
import { expensesReducer, computeBalanceDelta } from './modules/expenses/index.js';
import { categoryBudgetsReducer } from './modules/category-budgets/index.js';
import { expenseDraftsReducer } from './modules/expense-drafts/index.js';
import { debtsReducer, buildDebtPaymentExpense, buildDebtPaymentRecord } from './modules/debts/index.js';
import { goalsReducer } from './modules/goals/index.js';
import { settingsReducer, hasCompletedOnboarding, completeOnboardingAction } from './modules/settings/index.js';

// Each entry delegates one state slice to its module's own reducer,
// keyed by the action-type namespace (e.g. 'incomes/create' -> the
// `incomes` slice). Adding a module means adding one line here, per
// docs/ARCHITECTURE.md §7.
const SLICE_REDUCERS = [
  { key: 'incomes', prefix: 'incomes/', reducer: incomesReducer },
  { key: 'bills', prefix: 'bills/', reducer: billsReducer },
  { key: 'plannedExpenses', prefix: 'plannedExpenses/', reducer: plannedExpensesReducer },
  { key: 'budget', prefix: 'budget/', reducer: budgetReducer },
  { key: 'categoryBudgets', prefix: 'categoryBudgets/', reducer: categoryBudgetsReducer },
  // Brain Dump quick-capture data (docs/DATA-MODEL.md "ExpenseDraft") —
  // deliberately plain, generic slice routing, not a cross-slice special
  // case like expenses/incomes/bills above: creating or deleting a draft
  // never touches budget.currentBalanceCents itself. "Convert to expense"
  // (src/ui/components/inbox-section.js) dispatches a real
  // `expenses/create` (which *does* go through the special case above)
  // followed by `expenseDrafts/delete`, as two ordinary dispatches, not
  // one atomic transition — a draft is not money on its own, so there's
  // nothing for these two slices to ever be transiently inconsistent
  // about the way currentBalanceCents would be.
  { key: 'expenseDrafts', prefix: 'expenseDrafts/', reducer: expenseDraftsReducer },
  // Debt Tracking (docs/DATA-MODEL.md "Debt"). Ordinary create/update/
  // delete/toggle route generically here; only `debts/record-payment` is
  // a cross-slice special case (below), because a payment also logs an
  // Expense and debits Current Balance.
  { key: 'debts', prefix: 'debts/', reducer: debtsReducer },
  // Savings goals (docs/DATA-MODEL.md "Goal"). Plain generic slice
  // routing — no cross-slice effect: a goal's "already put away" amount
  // reduces Safe-to-Spend by being read straight out of `state.goals` by
  // the formula (docs/SAFE-TO-SPEND.md §3d), and creating one never
  // debits Current Balance. (The flat Savings figure used to work the
  // same way; it no longer subtracts from Safe-to-Spend — §9 — and
  // `budget/add-to-savings` *does* now debit the balance, handled as a
  // cross-slice special case in rootReducer below.)
  { key: 'goals', prefix: 'goals/', reducer: goalsReducer },
  { key: 'settings', prefix: 'settings/', reducer: settingsReducer },
];

// Basic app bookkeeping (docs/DATA-MODEL.md §1 already defines
// `meta.lastOpenedAt`) plus delegation to each feature module's own
// reducer. Unknown actions are a no-op by contract (see src/core/store.js).
export function rootReducer(state, action) {
  if (action.type === 'meta/touch-last-opened') {
    return { ...state, meta: { ...state.meta, lastOpenedAt: action.now } };
  }

  // Expenses get special handling, not the generic single-slice routing
  // below: logging/editing/deleting one also adjusts Current Balance
  // (docs/DATA-MODEL.md "Current Balance model") — a genuine cross-slice
  // effect that must land in the same state transition as the `expenses`
  // update, computed by src/modules/expenses/balance-effect.js and
  // applied here, the one place with visibility into both slices.
  if (action.type.startsWith('expenses/')) {
    const prevExpenses = state.expenses ?? [];
    const nextExpenses = expensesReducer(prevExpenses, action);
    const deltaCents = computeBalanceDelta(action, prevExpenses, nextExpenses);
    if (nextExpenses === prevExpenses && deltaCents === 0) return state;
    const prevBalanceCents = state.budget?.currentBalanceCents ?? 0;
    return {
      ...state,
      expenses: nextExpenses,
      budget: { ...state.budget, currentBalanceCents: prevBalanceCents + deltaCents },
    };
  }

  // Confirming an Income as received also gets special handling, same
  // shape as the Expenses case above, but touching *three* slices in one
  // transition, not two: the balance effect
  // (src/modules/incomes/balance-effect.js, docs/DATA-MODEL.md "Current
  // Balance model") plus a new historical record
  // (src/modules/income-receipts/, docs/DATA-MODEL.md "IncomeReceipt") —
  // the real log an unbounded period ("All time") sums from, instead of
  // projecting a schedule that has no meaningful "forever" total. Every
  // other `incomes/*` action (create/update/delete/toggle-active) falls
  // through to the generic routing below unchanged, exactly as before
  // this existed.
  if (action.type === 'incomes/mark-received') {
    const prevIncomes = state.incomes ?? [];
    const nextIncomes = incomesReducer(prevIncomes, action);
    const deltaCents = computeIncomeBalanceDelta(action, prevIncomes, nextIncomes);
    if (nextIncomes === prevIncomes && deltaCents === 0) return state;
    const prevBalanceCents = state.budget?.currentBalanceCents ?? 0;
    // Read from prevIncomes — the confirmed income's amount/name don't
    // change during this mutation, but the pre-mutation slice is
    // guaranteed to contain it (the reducer only got this far because a
    // matching id was found).
    const confirmedIncome = prevIncomes.find((income) => income.id === action.id);
    const receipt = createIncomeReceipt(confirmedIncome, new Date(action.now));
    const prevReceipts = state.incomeReceipts ?? [];
    return {
      ...state,
      incomes: nextIncomes,
      incomeReceipts: receipt ? [...prevReceipts, receipt] : prevReceipts,
      budget: { ...state.budget, currentBalanceCents: prevBalanceCents + deltaCents },
    };
  }

  // Marking a Bill paid/unpaid also gets special handling, same shape as
  // the Income case above — touching three slices, not two: the balance
  // effect (src/modules/bills/balance-effect.js, docs/DATA-MODEL.md
  // "Current Balance model" — without this, paying a bill removed it from
  // Safe-to-Spend's `upcomingBillsCents` subtraction but never actually
  // debited the balance, so the money looked like it "came back," a real
  // reported bug) plus a new historical record
  // (src/modules/bill-payments/, docs/DATA-MODEL.md "BillPayment") — the
  // real log a period's "Money out" sums from, so it reflects what was
  // actually paid, not merely what was due. Un-marking a bill (paid ->
  // unpaid again) removes the most recent payment logged for it, undoing
  // the log entry for the specific payment being reversed — a bill can
  // cycle paid/unpaid more than once, and only that one entry corresponds
  // to *this* reversal. Every other `bills/*` action (create/update/
  // delete/toggle-active) falls through to the generic routing below
  // unchanged.
  if (action.type === 'bills/toggle' && action.field === 'paid') {
    const prevBills = state.bills ?? [];
    const nextBills = billsReducer(prevBills, action);
    const deltaCents = computeBillBalanceDelta(action, prevBills, nextBills);
    if (nextBills === prevBills && deltaCents === 0) return state;
    const prevBalanceCents = state.budget?.currentBalanceCents ?? 0;
    const prevPayments = state.billPayments ?? [];
    const confirmedBill = nextBills.find((bill) => bill.id === action.id);
    let nextPayments = prevPayments;
    if (confirmedBill?.paid) {
      // Read from prevBills — the confirmed bill's amount/name don't
      // change during this mutation, but the pre-mutation slice is
      // guaranteed to contain it (the reducer only got this far because a
      // matching id was found).
      const beforeBill = prevBills.find((bill) => bill.id === action.id);
      const payment = createBillPayment(beforeBill, new Date(action.now));
      if (payment) nextPayments = [...prevPayments, payment];
    } else {
      const lastIndex = prevPayments.map((payment) => payment.billId).lastIndexOf(action.id);
      if (lastIndex !== -1) nextPayments = [...prevPayments.slice(0, lastIndex), ...prevPayments.slice(lastIndex + 1)];
    }
    return {
      ...state,
      bills: nextBills,
      billPayments: nextPayments,
      budget: { ...state.budget, currentBalanceCents: prevBalanceCents + deltaCents },
    };
  }

  // Recording a Debt payment: same three-slice-plus-balance shape as the
  // Income/Bill cases above. The debt's own `currentBalanceCents` drops
  // (clamped at 0 — src/modules/debts/reducer.js); a real `Expense` is
  // appended so the money shows in the expense history and reduces
  // Current Balance -> Safe-to-Spend exactly once, through the ordinary
  // Expense pathway (docs/DATA-MODEL.md §3a, SAFE-TO-SPEND.md §3c) — the
  // debt balance itself is never read by the Safe-to-Spend calculation,
  // so there's no double count; and a `DebtPayment` log record is added,
  // the Debt-side counterpart to `BillPayment`. All atomic.
  if (action.type === 'debts/record-payment') {
    const prevDebts = state.debts ?? [];
    const nextDebts = debtsReducer(prevDebts, action);
    if (nextDebts === prevDebts) return state; // no-op: unknown debt, $0/invalid amount, or already at $0
    const debt = prevDebts.find((d) => d.id === action.debtId);
    const expense = buildDebtPaymentExpense(debt, action);
    if (!expense) return { ...state, debts: nextDebts }; // debt balance changed but nothing valid to log — shouldn't happen, guard anyway
    const record = buildDebtPaymentRecord(debt, action, expense.id);
    const prevBalanceCents = state.budget?.currentBalanceCents ?? 0;
    return {
      ...state,
      debts: nextDebts,
      expenses: [...(state.expenses ?? []), expense],
      debtPayments: record ? [...(state.debtPayments ?? []), record] : (state.debtPayments ?? []),
      budget: { ...state.budget, currentBalanceCents: prevBalanceCents - expense.amountCents },
    };
  }

  // Adding money to Savings is a real transfer out of Current Balance,
  // not a bookkeeping label — same cross-slice shape as the cases above,
  // touching two slices in one transition. `budgetReducer` raises
  // `savingsAllocationCents`; here we also debit `currentBalanceCents` by
  // the same amount, so the money reaches Safe-to-Spend exactly once (via
  // the reduced balance — the Savings figure itself is display-only,
  // docs/SAFE-TO-SPEND.md §9). `setSavingsAllocationAction`
  // ('budget/set') — used by onboarding and the "correct the total"
  // pencil — is a plain record edit with NO balance effect, and falls
  // through to the generic routing below unchanged.
  if (action.type === 'budget/add-to-savings') {
    const prevBudget = state.budget ?? {};
    const nextBudget = budgetReducer(prevBudget, action);
    if (nextBudget === prevBudget) return state; // rejected: invalid / $0 / negative
    const prevBalanceCents = prevBudget.currentBalanceCents ?? 0;
    return {
      ...state,
      budget: { ...nextBudget, currentBalanceCents: prevBalanceCents - action.amountCents },
    };
  }

  for (const { key, prefix, reducer } of SLICE_REDUCERS) {
    if (action.type.startsWith(prefix)) {
      const nextSlice = reducer(state[key], action);
      if (nextSlice === state[key]) return state;
      return { ...state, [key]: nextSlice };
    }
  }
  return state;
}

/**
 * A returning user who already had real budget data before onboarding
 * existed (Phases 2-6) shouldn't be interrupted by a "let's set up your
 * budget" flow implying they haven't started anything yet — see
 * src/ui/screens/onboarding.js. Used once, at load, to backfill
 * `onboardingCompletedAt` for such users rather than showing the flow.
 */
function hasExistingBudgetData(state) {
  const budget = state.budget ?? {};
  return (
    (budget.currentBalanceCents ?? 0) !== 0 ||
    (budget.savingsAllocationCents ?? 0) !== 0 ||
    (budget.safetyBufferCents ?? 0) !== 0 ||
    (state.incomes?.length ?? 0) > 0 ||
    (state.bills?.length ?? 0) > 0 ||
    (state.plannedExpenses?.length ?? 0) > 0 ||
    (state.expenses?.length ?? 0) > 0 ||
    (state.categoryBudgets?.length ?? 0) > 0 ||
    (state.incomeReceipts?.length ?? 0) > 0 ||
    (state.billPayments?.length ?? 0) > 0 ||
    (state.debts?.length ?? 0) > 0
  );
}

/**
 * Wires the storage adapter to a fresh store: loads persisted state (or a
 * safe empty state), creates the store, keeps every dispatched change
 * persisted, and records that the app was opened. Pure composition, no
 * DOM — safe to call from tests.
 *
 * @param {object} [options]
 * @param {ReturnType<typeof createStorageAdapter>} [options.storageAdapter]
 * @param {object} [options.storageOptions] passed to createStorageAdapter if storageAdapter isn't given
 * @param {Date} [options.now]
 */
export function initAppState(options = {}) {
  const adapter = options.storageAdapter ?? createStorageAdapter(options.storageOptions);
  const now = options.now ?? new Date();
  const initialState = adapter.load();
  const store = createStore(rootReducer, initialState);
  store.subscribe((nextState) => adapter.scheduleSave(nextState));
  store.dispatch({ type: 'meta/touch-last-opened', now: now.toISOString() });
  if (!hasCompletedOnboarding(store.getState()) && hasExistingBudgetData(store.getState())) {
    store.dispatch(completeOnboardingAction({ now }));
  }
  return { store, adapter };
}

/**
 * initAppState(), but degrades to an in-memory-only store rather than
 * throwing if localStorage is unavailable (private-browsing edge cases,
 * storage disabled) — see docs/ARCHITECTURE.md §8.
 */
function initResilientAppState() {
  try {
    const { store, adapter } = initAppState();
    return { store, adapter, persistenceUnavailable: false };
  } catch (error) {
    console.warn('ADHD Budget Planner: local storage is unavailable; continuing without persistence.', error);
    const store = createStore(rootReducer, createEmptyState());
    return { store, adapter: null, persistenceUnavailable: true };
  }
}

/**
 * @param {HTMLElement} container
 * @param {unknown} [error] shown collapsed, for troubleshooting — never
 *   the primary message (docs/PRODUCT.md's calm-not-alarming principle
 *   still applies), but visible without needing dev tools, which turned
 *   out to be the real blocker: getting the actual error out of Safari's
 *   panels via description alone was unreliable in practice.
 */
function renderFatalError(container, error) {
  container.innerHTML = '';
  const message = document.createElement('p');
  message.className = 'fatal-error';
  message.setAttribute('role', 'alert');
  message.textContent =
    'Something went wrong loading the app. Your data is safe on this device — try reloading the page.';
  container.appendChild(message);

  if (error) {
    const details = document.createElement('details');
    details.className = 'fatal-error__details';
    const summary = document.createElement('summary');
    summary.textContent = 'Technical details';
    const pre = document.createElement('pre');
    pre.textContent = error?.stack || `${error?.name || 'Error'}: ${error?.message || String(error)}`;
    details.appendChild(summary);
    details.appendChild(pre);
    container.appendChild(details);
  }
}

function init() {
  const container = document.getElementById('app');
  if (!container) return;

  let adapter = null;
  try {
    const bus = createEventBus();
    const resilient = initResilientAppState();
    adapter = resilient.adapter;
    mountShell({
      container,
      store: resilient.store,
      bus,
      persistenceUnavailable: resilient.persistenceUnavailable,
    });
  } catch (error) {
    // Fail gracefully rather than leaving a blank screen — see
    // docs/ARCHITECTURE.md §8 and CLAUDE.md's error-handling expectations.
    // The real error goes to the console for developers; the user only
    // sees a calm, non-technical message.
    console.error('ADHD Budget Planner failed to start:', error);
    renderFatalError(container, error);
    return;
  }

  if (adapter) {
    const flush = () => adapter.flush();
    // Flush any debounced save on page hide/unload so the last change
    // isn't lost — see docs/ARCHITECTURE.md §5.
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
