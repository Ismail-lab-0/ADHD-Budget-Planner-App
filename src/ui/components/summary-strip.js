// The summary strip — a compact, lightweight row of stat tiles at the very
// top of the dashboard, above the Safe-to-Spend hero, so the numbers a
// user most needs are scannable in under 2 seconds without reading any
// card. Pure UI composition: every figure here is read from values already
// computed elsewhere (`getExpensesTotalCents`, `getUpcomingBillsTotalCents`,
// `getUpcomingBills`, `getAllExpenseDrafts`) — this file does no money
// arithmetic or date math of its own, same "composition only" rule as
// src/modules/dashboard/index.js. Deliberately lighter than a `.card` (see
// `.summary-tile` in components.css) — a glance strip, not another card
// competing for attention with the hero right below it.
//
// Originally: Safe to spend, Bills due, Days left, Inbox items. At the
// user's explicit request, Safe to spend was replaced with Total expenses
// (position 1 — Safe to Spend is still the hero's own job, right below
// this strip, so showing it twice in a row added little), and Days left
// was replaced with Total bills and moved up to position 2, right after
// Total expenses — Bills due (the count) and Inbox items shifted down to
// fill positions 3 and 4 accordingly. `daysUntilPayday` (only ever used
// for the old "Days left" tile) is still computed by `getSafeToSpend` and
// still shown nowhere else — same "kept available, not deleted just
// because a UI stopped using it" treatment `upcomingBillsCents` got
// before this file existed.

import { el } from '../dom.js';
import { iconChip } from './icons.js';
import { formatCents } from '../../core/money.js';
import { getUpcomingBills, getUpcomingBillsTotalCents } from '../../modules/dashboard/index.js';
import { getAllExpenseDrafts } from '../../modules/expense-drafts/index.js';
import { getAllExpenses, getExpensesTotalCents } from '../../modules/expenses/index.js';

function tile({ icon, label, value, color }) {
  return el('div', { class: 'summary-tile' }, [
    iconChip(icon, { color, small: true }),
    el('div', { class: 'summary-tile__text' }, [
      el('span', { class: 'summary-tile__value' }, value),
      el('span', { class: 'summary-tile__label' }, label),
    ]),
  ]);
}

/**
 * @param {object} options
 * @param {object} options.state
 */
export function renderSummaryStrip({ state }) {
  const totalExpensesCents = getExpensesTotalCents(getAllExpenses(state));
  const totalBillsCents = getUpcomingBillsTotalCents(state);
  const { totalCount: billsDueCount } = getUpcomingBills(state, { limit: 3 });
  const inboxCount = getAllExpenseDrafts(state).length;

  return el('div', { class: 'summary-strip' }, [
    tile({
      icon: 'receipt',
      label: 'Total expenses',
      value: formatCents(totalExpensesCents),
      color: 'var(--color-accent)',
    }),
    tile({
      icon: 'file-text',
      label: 'Total bills',
      value: formatCents(totalBillsCents),
      color: totalBillsCents > 0 ? 'var(--color-status-caution-text)' : 'var(--color-text-secondary)',
    }),
    tile({
      icon: 'file-text',
      label: billsDueCount === 1 ? 'Bill due' : 'Bills due',
      value: String(billsDueCount),
      color: billsDueCount > 0 ? 'var(--color-status-caution-text)' : 'var(--color-text-secondary)',
    }),
    tile({
      icon: 'zap',
      label: inboxCount === 1 ? 'Inbox item' : 'Inbox items',
      value: String(inboxCount),
      color: inboxCount > 0 ? 'var(--color-accent)' : 'var(--color-text-secondary)',
    }),
  ]);
}
