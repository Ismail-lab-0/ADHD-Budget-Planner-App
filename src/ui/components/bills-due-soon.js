// "Bills due soon" — a small highlighted card pulling out just the
// nearest unpaid bills for a quick glance + one-tap "Mark paid", separate
// from the fuller Upcoming Commitments list (which also covers planned
// expenses). Selection lives in src/modules/dashboard/index.js
// (composition only); this file only renders it. Also owns "Manage
// bills" — a full CRUD popup over every bill (paid and unpaid, not just
// the nearest 3), added at the user's request, mirroring exactly how
// src/ui/components/category-budgets-section.js's "Edit categories"
// popup already works (add-form at top, existing records below with
// inline edit/delete).

import { el } from '../dom.js';
import { emptyState } from './empty-state.js';
import { sectionHeading, iconChip, iconButton } from './icons.js';
import { renderBillForm } from './bills-section.js';
import { renderPopup } from './popup.js';
import { formatCents } from '../../core/money.js';
import { isOverdue, daysBetween, parseLocalDate } from '../../core/date.js';
import { toggleBillPaidAction, createBillAction, updateBillAction, deleteBillAction, getAllBills } from '../../modules/bills/index.js';
import { getUpcomingBills } from '../../modules/dashboard/index.js';

// Transient UI state, deliberately outside the store (see
// docs/ARCHITECTURE.md §4) — same convention as every other popup/inline-
// edit toggle in this app.
let billsManageOpen = false;
let editingBillId = null;

function dueLabel(dateStr, now) {
  const days = daysBetween(now, parseLocalDate(dateStr));
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days > 1) return `Due in ${days} days`;
  return `Due ${dateStr}`;
}

function billRow({ bill, now, dispatch }) {
  const overdue = bill.date != null && isOverdue(bill.date, now);
  const dateText = bill.date == null ? 'No due date' : overdue ? 'Overdue' : dueLabel(bill.date, now);

  return el('div', { class: 'bills-due-soon__row' }, [
    iconChip('file-text', { color: overdue ? 'var(--color-status-attention-text)' : 'var(--color-status-caution-text)' }),
    el('div', { class: 'bills-due-soon__info' }, [
      el('span', { class: 'bills-due-soon__name' }, bill.name),
      el('span', { class: `bills-due-soon__date${overdue ? ' bills-due-soon__date--overdue' : ''}` }, dateText),
    ]),
    el('span', { class: 'bills-due-soon__amount' }, formatCents(bill.amountCents)),
    el(
      'button',
      { type: 'button', class: 'btn btn--secondary btn--small', onclick: () => dispatch(toggleBillPaidAction(bill.id, { now })) },
      'Mark paid'
    ),
  ]);
}

const RECURRENCE_META_LABEL = { 'one-time': 'One-time', weekly: 'Weekly', monthly: 'Monthly' };

function manageBillRow({ bill, now, dispatch, requestRender }) {
  if (bill.id === editingBillId) {
    return el('li', { class: 'money-item money-item--editing' }, [
      renderBillForm({
        bill,
        onSubmit: (changes) => {
          dispatch(updateBillAction(bill.id, changes, { now }));
          editingBillId = null;
          requestRender?.();
        },
        onCancel: () => {
          editingBillId = null;
          requestRender?.();
        },
      }),
    ]);
  }

  const metaParts = [formatCents(bill.amountCents), RECURRENCE_META_LABEL[bill.recurrence] ?? 'One-time'];
  if (bill.dueDate) metaParts.push(bill.dueDate);
  metaParts.push(bill.paid ? 'Paid' : 'Unpaid');

  return el('li', { class: 'money-item' }, [
    el('div', { class: 'money-item__body' }, [
      el('span', { class: 'money-item__title' }, bill.name),
      el('span', { class: 'money-item__meta-text' }, metaParts.join(' · ')),
    ]),
    el('div', { class: 'money-item__actions' }, [
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn--secondary btn--small',
          onclick: () => dispatch(toggleBillPaidAction(bill.id, { now })),
        },
        bill.paid ? 'Mark unpaid' : 'Mark paid'
      ),
      iconButton('edit', `Edit ${bill.name}`, () => {
        editingBillId = bill.id;
        requestRender?.();
      }),
      iconButton(
        'trash',
        `Delete ${bill.name}`,
        () => {
          if (window.confirm(`Delete "${bill.name}"? This can't be undone.`)) {
            dispatch(deleteBillAction(bill.id));
          }
        },
        { tone: 'attention' }
      ),
    ]),
  ]);
}

function renderManageBillsPopup({ state, dispatch, requestRender, now }) {
  const close = () => {
    billsManageOpen = false;
    editingBillId = null;
    requestRender?.();
  };

  const bills = getAllBills(state);
  const rows = bills.map((bill) => manageBillRow({ bill, now, dispatch, requestRender }));

  const body = el('div', {}, [
    renderBillForm({ onSubmit: (input) => dispatch(createBillAction(input, { now })) }),
    bills.length > 0
      ? el('ul', { class: 'money-list', style: 'margin-top: var(--space-4)' }, rows)
      : emptyState('No bills yet — add one above.'),
  ]);

  return renderPopup({ titleId: 'manage-bills-heading', title: 'Manage bills', body, onClose: close });
}

/**
 * @param {object} options
 * @param {object} options.state
 * @param {Function} options.dispatch
 * @param {Date} [options.now]
 * @param {() => void} [options.requestRender]
 */
export function renderBillsDueSoon({ state, dispatch, now = new Date(), requestRender }) {
  const { items } = getUpcomingBills(state, { limit: 3 });

  const body =
    items.length === 0
      ? emptyState('No unpaid bills right now.')
      : el(
          'div',
          { class: 'bills-due-soon__list' },
          items.map((bill) => billRow({ bill, now, dispatch }))
        );

  const manageLink = el(
    'button',
    { type: 'button', class: 'link-button', onclick: () => { billsManageOpen = true; requestRender?.(); } },
    'Manage bills'
  );

  const popup = billsManageOpen ? renderManageBillsPopup({ state, dispatch, requestRender, now }) : null;

  return el(
    'section',
    { class: 'card card--quiet bills-due-soon', 'aria-labelledby': 'bills-due-soon-heading' },
    [
      el('div', { class: 'card__header-row' }, [
        sectionHeading('file-text', 'Bills due soon', 'bills-due-soon-heading', { color: 'var(--color-status-caution-text)' }),
        manageLink,
      ]),
      body,
      popup,
    ].filter(Boolean)
  );
}
