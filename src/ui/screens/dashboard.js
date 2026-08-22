// The Dashboard — the app's only screen. Every dollar figure that isn't
// period-scoped still comes from `getSafeToSpend(state)`
// (src/modules/safe-to-spend/) — this file never recomputes Safe-to-Spend
// itself, only renders it. Period-scoped figures (This Period, Expenses)
// come from `getPeriodSummary`/`getExpensesForPeriod` for whatever the
// header bar's global period selector currently has selected — see
// docs/ARCHITECTURE.md and CLAUDE.md "Current status" for the full
// redesign rationale, including why Safe-to-Spend and Current Balance
// deliberately never read the selected period.

import { el } from '../dom.js';
import { icon } from '../components/icons.js';
import { renderHeaderBar } from '../components/header-bar.js';
import { renderSafeToSpendHero } from '../components/safe-to-spend-hero.js';
import { renderSingleValueSection } from '../components/single-value-section.js';
import { renderPeriodSummary } from '../components/period-summary.js';
import { renderBillsDueSoon } from '../components/bills-due-soon.js';
import { renderUpcomingIncome } from '../components/upcoming-income.js';
import { renderCategoryBudgetsSection } from '../components/category-budgets-section.js';
import { renderExpensesSection } from '../components/expenses-section.js';
import { getDefaultPeriodValue } from '../components/period-selector.js';
import { getGreetingPeriod, formatFriendlyDate } from '../../core/date.js';
import { getSafeToSpend } from '../../modules/safe-to-spend/index.js';
import { getPeriodSummary } from '../../modules/dashboard/index.js';
import { resolvePeriodRange } from '../../modules/expenses/index.js';
import { getCurrentBalanceCents, setCurrentBalanceAction, getSavingsAllocationCents, addToSavingsAction, setSavingsAllocationAction } from '../../modules/budget/index.js';

const GREETING_BY_PERIOD = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' };

// The header bar's global period selector — the single shared source of
// truth for every period-scoped card on this page. Transient UI state,
// deliberately outside the store (see docs/ARCHITECTURE.md §4) and not
// persisted, same convention as every other UI toggle in this app; resets
// to "This month" on reload.
let selectedPeriod = getDefaultPeriodValue();

function greetingText(state, now) {
  const period = getGreetingPeriod(now);
  const base = GREETING_BY_PERIOD[period];
  const name = state?.settings?.displayName;
  return name ? `${base}, ${name}.` : `${base}.`;
}

/**
 * @param {object} options
 * @param {object} options.state current app state (read-only)
 * @param {Function} options.dispatch
 * @param {Date} [options.now]
 * @param {() => void} [options.requestRender]
 * @returns {HTMLElement}
 */
export function renderDashboard({ state, dispatch, now = new Date(), requestRender }) {
  const result = getSafeToSpend(state, { now });

  const range = resolvePeriodRange(selectedPeriod.period, { now, from: selectedPeriod.from, to: selectedPeriod.to }) ?? { startDateKey: null, endDateKey: null };
  const periodSummary = getPeriodSummary(state, { startDateKey: range.startDateKey, endDateKey: range.endDateKey, now });

  const headerBar = renderHeaderBar({
    state,
    dispatch,
    period: selectedPeriod,
    onPeriodChange: (next) => {
      selectedPeriod = next;
      requestRender?.();
    },
    requestRender,
  });

  // Two columns at desktop width (src/styles/responsive.css
  // `.dashboard-grid`) — a wider "main" column for the primary
  // money-management content (hero, categories, expenses) and a narrower,
  // visually quieter "side" column for at-a-glance secondary summaries.
  // Mobile/tablet render these two wrapper divs as a plain single stack.
  const mainColumn = el('div', { class: 'dashboard-grid__main' }, [
    renderSafeToSpendHero(result, { state, dispatch, requestRender }),
    renderCategoryBudgetsSection({ state, dispatch, now, requestRender }),
    renderExpensesSection({ state, dispatch, requestRender, period: selectedPeriod }),
  ]);

  const sideColumn = el('div', { class: 'dashboard-grid__side' }, [
    renderPeriodSummary(periodSummary),
    renderSingleValueSection({
      id: 'current-balance-heading',
      title: 'Current balance',
      description: 'What you actually have right now.',
      valueCents: getCurrentBalanceCents(state),
      onSave: (cents) => dispatch(setCurrentBalanceAction(cents)),
      allowNegative: true,
      icon: 'wallet',
      requestRender,
    }),
    renderUpcomingIncome({ state, dispatch, now, requestRender }),
    renderBillsDueSoon({ state, dispatch, now, requestRender }),
    renderSingleValueSection({
      id: 'savings-heading',
      title: 'Savings',
      description: 'Money set aside and protected from discretionary spending.',
      valueCents: getSavingsAllocationCents(state),
      onSave: (cents) => dispatch(addToSavingsAction(cents)),
      onEditTotal: (cents) => dispatch(setSavingsAllocationAction(cents)),
      icon: 'target',
      additive: true,
      requestRender,
    }),
    el('p', { class: 'privacy-note' }, [icon('shield'), 'Your data stays on this device — private, no accounts.']),
  ]);

  return el('div', { class: 'screen screen--dashboard' }, [
    headerBar,
    el('header', { class: 'today-header' }, [
      el('h1', { class: 'today-header__greeting' }, greetingText(state, now)),
      el('p', { class: 'today-header__date' }, formatFriendlyDate(now)),
    ]),
    el('div', { class: 'dashboard-grid' }, [mainColumn, sideColumn]),
  ]);
}
