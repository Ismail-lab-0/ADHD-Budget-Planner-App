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

  // Each card is tagged with its own `dashboard-grid__item--*` class so
  // CSS can order it independently per breakpoint (src/styles/
  // components.css / responsive.css). Cards are grouped into two
  // `.dashboard-grid__col` wrapper divs — "main" (hero, categories,
  // expenses) and "side" (this period, current balance, upcoming income,
  // bills due soon, savings, the privacy note) — but that grouping only
  // matters at desktop width. On mobile, `.dashboard-grid__col` is
  // `display: contents` (removes its own box, promoting its children to
  // direct flex items of `.dashboard-grid`), so every card still follows
  // one flat `order` sequence there: hero -> balance -> this period ->
  // categories -> expenses -> upcoming income -> bills -> savings ->
  // privacy, the priority order asked for on a phone.
  //
  // The two-wrapper-div split was tried once before and reverted in
  // favor of one flat grid, because that version hard-coded DOM order as
  // layout order (see the now-superseded comment this replaced) — no
  // `order` property was involved, so mobile had no way to reorder
  // Current Balance/This Period ahead of Categories/Expenses without
  // literally moving them in the DOM. This version keeps the flat
  // `order`-driven approach for mobile but fixes a real desktop bug that
  // approach introduced: making every card a *direct* grid item left
  // rows auto-placed and shared across both columns, so a row's height
  // was forced to fit whichever column's card in that row was tallest —
  // pairing the tall Hero with the much shorter "This period" card left
  // "This period" stranded with a large empty gap below it before the
  // next row could start, and it compounded down the whole side column
  // (reported directly by the user from a screenshot). Wrapping each
  // column in its own flex container at desktop (`.dashboard-grid__col`,
  // responsive.css) gives each column independent stacking, immune to
  // the other column's card heights, while `display: contents` keeps the
  // exact same DOM available for mobile's flat `order` sequence.
  function gridItem(slot, node) {
    return el('div', { class: `dashboard-grid__item dashboard-grid__item--${slot}` }, node);
  }

  const mainColumn = el('div', { class: 'dashboard-grid__col dashboard-grid__col--main' }, [
    gridItem('hero', renderSafeToSpendHero(result, { state, dispatch, requestRender })),
    gridItem('categories', renderCategoryBudgetsSection({ state, dispatch, now, requestRender })),
    gridItem('expenses', renderExpensesSection({ state, dispatch, requestRender, period: selectedPeriod })),
  ]);

  const sideColumn = el('div', { class: 'dashboard-grid__col dashboard-grid__col--side' }, [
    gridItem('period', renderPeriodSummary(periodSummary)),
    gridItem(
      'balance',
      renderSingleValueSection({
        id: 'current-balance-heading',
        title: 'Current balance',
        description: 'What you actually have right now.',
        valueCents: getCurrentBalanceCents(state),
        onSave: (cents) => dispatch(setCurrentBalanceAction(cents)),
        allowNegative: true,
        icon: 'wallet',
        requestRender,
      })
    ),
    gridItem('income', renderUpcomingIncome({ state, dispatch, now, requestRender })),
    gridItem('bills', renderBillsDueSoon({ state, dispatch, now, requestRender })),
    gridItem(
      'savings',
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
      })
    ),
    gridItem('privacy', el('p', { class: 'privacy-note' }, [icon('shield'), 'Your data stays on this device — private, no accounts.'])),
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
