// "Upcoming income" — the nearest not-yet-received incomes, with a
// one-tap "Mark received" that credits Current Balance automatically (see
// docs/DATA-MODEL.md "Current Balance model"). Deliberately not
// period-scoped, same as "Bills due soon" — always "what's next,"
// regardless of the header bar's global period selector. Selection lives
// in src/modules/dashboard/index.js `getUpcomingIncome` (composition
// only); this file only renders it and reuses the existing
// `markIncomeReceivedAction` — no new income-related math here.

import { el } from '../dom.js';
import { emptyState } from './empty-state.js';
import { sectionHeading, iconChip } from './icons.js';
import { renderIncomeForm } from './income-section.js';
import { renderPopup } from './popup.js';
import { formatCents } from '../../core/money.js';
import { isOverdue, daysBetween, parseLocalDate } from '../../core/date.js';
import { markIncomeReceivedAction, createIncomeAction } from '../../modules/incomes/index.js';
import { getUpcomingIncome } from '../../modules/dashboard/index.js';

// Whether the "+ Add income" popup is open — transient UI state,
// deliberately outside the store (see docs/ARCHITECTURE.md §4). Moved
// here from "This Period" (since folded into the merged "Right now" card
// — src/ui/components/right-now-section.js — which has no add-income
// affordance of its own) so "add income" lives next to the list it
// actually shows up in.
let addIncomeFormOpen = false;

function expectedLabel(dateStr, now) {
  const days = daysBetween(now, parseLocalDate(dateStr));
  if (days === 0) return 'Expected today';
  if (days === 1) return 'Expected tomorrow';
  if (days > 1) return `Expected in ${days} days`;
  return `Expected ${dateStr}`;
}

function incomeRow({ income, now, dispatch }) {
  const overdue = income.date != null && isOverdue(income.date, now);
  const dateText = income.date == null ? 'No date set' : overdue ? 'Expected earlier' : expectedLabel(income.date, now);

  return el('div', { class: 'upcoming-income__row' }, [
    iconChip('trending-up', { color: 'var(--color-status-positive-text)' }),
    el('div', { class: 'upcoming-income__info' }, [
      el('span', { class: 'upcoming-income__name' }, income.name),
      el('span', { class: 'upcoming-income__date' }, dateText),
    ]),
    el('span', { class: 'upcoming-income__amount' }, formatCents(income.amountCents)),
    el(
      'button',
      { type: 'button', class: 'btn btn--secondary btn--small', onclick: () => dispatch(markIncomeReceivedAction(income.id, { now })) },
      'Mark received'
    ),
  ]);
}

/**
 * @param {object} options
 * @param {object} options.state
 * @param {Function} options.dispatch
 * @param {Date} [options.now]
 * @param {() => void} [options.requestRender]
 */
export function renderUpcomingIncome({ state, dispatch, now = new Date(), requestRender }) {
  const { items } = getUpcomingIncome(state, { limit: 3 });

  const body =
    items.length === 0
      ? emptyState('No income scheduled right now.')
      : el(
          'div',
          { class: 'upcoming-income__list' },
          items.map((income) => incomeRow({ income, now, dispatch }))
        );

  const close = () => {
    addIncomeFormOpen = false;
    requestRender?.();
  };
  const addLink = el(
    'button',
    { type: 'button', class: 'link-button', onclick: () => { addIncomeFormOpen = true; requestRender?.(); } },
    '+ Add income'
  );
  const popup = addIncomeFormOpen
    ? renderPopup({
        titleId: 'add-income-heading',
        title: 'Add income',
        body: renderIncomeForm({ onSubmit: (input) => { dispatch(createIncomeAction(input, { now })); close(); } }),
        onClose: close,
      })
    : null;

  return el(
    'section',
    { class: 'card card--quiet upcoming-income', 'aria-labelledby': 'upcoming-income-heading' },
    [
      el('div', { class: 'card__header-row' }, [
        sectionHeading('trending-up', 'Upcoming income', 'upcoming-income-heading', { color: 'var(--color-status-positive-text)' }),
        addLink,
      ]),
      body,
      popup,
    ].filter(Boolean)
  );
}
