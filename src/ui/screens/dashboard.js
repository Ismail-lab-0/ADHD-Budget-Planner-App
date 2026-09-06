// The Dashboard — laid out after the reference the user shared:
//   - `.dashboard__top`   — three equal headline stat cards (Total
//     Expenses this month · Total Savings · Total debt to pay)
//   - `.dashboard__mid`   — "Estimated safe to spend" beside the
//     "Income vs Expenses" chart, matched heights (the chart's natural
//     height drives the row; the hero fills it with its disclaimer
//     pinned to the bottom, so there's no dead space under either)
//   - `.dashboard__bottom` — a two-up row (Budget progress · Recent
//     Expenses), then the Inbox and the privacy line
// Each grid collapses to fewer columns on tablet and a single column on
// mobile (breakpoints in responsive.css). Every number comes from the
// existing selectors — no new metrics, no mock data.
//
// The "+ Add expense" action lives at the top of the page — the view
// header's `titleAction` — not on the hero card.
//
// Everything else (full management of income / expenses / bills / debts /
// categories / budget) lives on its own sidebar view.

import { el } from '../dom.js';
import { icon } from '../components/icons.js';
import { renderAppFrame } from '../components/app-frame.js';
import { renderSafeToSpendHero } from '../components/safe-to-spend-hero.js';
import { renderStatCard } from '../components/stat-card.js';
import { renderColumnChart } from '../components/charts.js';
import { renderExpensesSection, renderExpenseForm } from '../components/expenses-section.js';
import { renderCategoryBudgetsSection } from '../components/category-budgets-section.js';
import { renderInboxSection } from '../components/inbox-section.js';
import { renderPopup } from '../components/popup.js';
import { getSelectedPeriod, getPeriodLabel } from '../components/period-selector.js';
import { navigateToView } from '../router.js';
import { getGreetingPeriod, formatFriendlyDate } from '../../core/date.js';
import { formatCents } from '../../core/money.js';
import { getMonthlyInVsOut, getExpensesMonthOverMonth, getSafeToSpendBreakdown } from '../../modules/dashboard/index.js';
import { getSavingsAllocationCents } from '../../modules/budget/index.js';
import { getTotalDebtCents } from '../../modules/debts/index.js';
import { createExpenseAction, getExpensesForPeriod, getExpensesTotalCents } from '../../modules/expenses/index.js';
import { canAddExpense, renderDemoNotice } from '../demo-gate.js';

const GREETING_BY_PERIOD = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' };

// Whether the top-of-page "+ Add expense" popup is open — transient UI
// state, deliberately outside the store (see docs/ARCHITECTURE.md §4).
let dashboardAddExpenseOpen = false;

function greetingText(state, now) {
  const base = GREETING_BY_PERIOD[getGreetingPeriod(now)];
  const name = state?.settings?.displayName;
  return name ? `${base}, ${name}.` : `${base}.`;
}

/**
 * @param {object} options
 * @param {object} options.state
 * @param {Function} options.dispatch
 * @param {Date} [options.now]
 * @param {() => void} [options.requestRender]
 * @returns {HTMLElement}
 */
export function renderDashboard({ state, dispatch, now = new Date(), requestRender }) {
  // getSafeToSpendBreakdown = getSafeToSpend(state) + a `period` block so
  // the hero's "How is this worked out?" panel can show this month's
  // spending as visible deductions (it's a superset — every other
  // consumer of `result` reads the same fields as before).
  const result = getSafeToSpendBreakdown(state, { now });
  const period = getSelectedPeriod();

  // ---- headline stat cards ----
  // Total expenses follows the header bar's global period filter; the
  // month-over-month delta chip only makes sense for "This month", so
  // it's shown only then (`mom` compares this vs. last calendar month).
  const mom = getExpensesMonthOverMonth(state, { now });
  const periodExpensesCents = getExpensesTotalCents(
    getExpensesForPeriod(state, { period: period.period, from: period.from, to: period.to, now })
  );
  const expensesCard = renderStatCard({
    icon: 'receipt',
    label: `Total expenses · ${getPeriodLabel(period)}`,
    value: formatCents(periodExpensesCents),
    delta: period.period === 'month' && mom.deltaPct != null ? { pct: mom.deltaPct, isGood: mom.deltaPct <= 0 } : null,
  });
  const savingsCard = renderStatCard({
    icon: 'target',
    label: 'Total savings',
    value: formatCents(getSavingsAllocationCents(state)),
  });
  const debtCard = renderStatCard({
    icon: 'credit-card',
    label: 'Total debt to pay',
    value: formatCents(getTotalDebtCents(state)),
  });

  // ---- Overview: income vs expenses per month ----
  const monthly = getMonthlyInVsOut(state, { now });
  const overviewCard = renderColumnChart({
    title: 'Income vs Expenses',
    subtitle: `Each month · ${now.getFullYear()}`,
    bars: monthly.map((m) => ({ label: m.label, values: [m.inCents, m.outCents] })),
    series: [
      { label: 'Income', color: 'var(--color-chart-income)' },
      { label: 'Expenses', color: 'var(--color-chart-expense)' },
    ],
    emptyMessage: 'No income or expenses logged this year yet.',
  });

  // ---- Recent Expenses (period-scoped, read-only) ----
  const recentCard = renderExpensesSection({
    state,
    dispatch,
    now,
    requestRender,
    period,
    compact: true,
    onViewAll: () => navigateToView('expenses'),
  });

  // ---- Budget progress ----
  const budgetCard = renderCategoryBudgetsSection({
    state,
    dispatch,
    now,
    requestRender,
    compact: true,
    onViewAll: () => navigateToView('categories'),
  });

  // ---- "+ Add expense", top of the page (view-header action) ----
  const closeAddExpense = () => {
    dashboardAddExpenseOpen = false;
    requestRender?.();
  };
  const addExpenseButton = el(
    'button',
    { type: 'button', class: 'btn btn--primary btn--small', onclick: () => { dashboardAddExpenseOpen = true; requestRender?.(); } },
    '+ Add expense'
  );
  const addExpensePopup = dashboardAddExpenseOpen
    ? renderPopup({
        titleId: 'dashboard-add-expense-heading',
        title: 'Add expense',
        body: renderExpenseForm({ state, onSubmit: (input) => {
          if (!canAddExpense(state)) { closeAddExpense(); return; }
          dispatch(createExpenseAction(input, { now }));
          closeAddExpense();
        } }),
        onClose: closeAddExpense,
      })
    : null;

  const body = el('div', { class: 'dashboard' }, [
    el('div', { class: 'dashboard__top' }, [expensesCard, savingsCard, debtCard]),
    el('div', { class: 'dashboard__mid' }, [renderSafeToSpendHero(result), overviewCard]),
    el('div', { class: 'dashboard__bottom' }, [budgetCard, recentCard]),
    renderInboxSection({ state, dispatch, now, requestRender }),
    el('p', { class: 'privacy-note' }, [icon('shield'), 'Your data stays on this device — private, no accounts.']),
    renderDemoNotice(state),
    addExpensePopup,
  ].filter(Boolean));

  return renderAppFrame({
    state,
    dispatch,
    requestRender,
    activeView: 'dashboard',
    title: greetingText(state, now),
    subtitle: formatFriendlyDate(now),
    titleAction: addExpenseButton,
    body,
  });
}
