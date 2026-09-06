// Bills. Two modes:
//   - compact (Dashboard summary — currently unused): the "due soon"
//     glance list (nearest unpaid bills + any debt minimum-payment due,
//     capped) inside a tinted card + a "View all bills →" link. Read-only
//     apart from one-tap "Mark paid". Debt Tracking integration
//     (docs/PRODUCT.md §8): a debt's minimum payment shows here as an
//     ordinary row whose "Make payment" routes to the Debts view.
//   - full (the Bills view, src/ui/screens/bills-view.js): a tinted
//     "Bills paid · <period>" summary card (period-scoped, with the
//     outstanding total as its note), then every bill (paid and unpaid)
//     as its own card with Mark paid/unpaid + a pencil to edit (inline
//     form) + a trash to delete — the same row shape as the Income view.
//     No debt rows here; debts live on their own view.

import { el } from '../dom.js';
import { emptyState } from './empty-state.js';
import { renderStatCard } from './stat-card.js';
import { sectionHeading, iconChip, iconButton } from './icons.js';
import { renderBillForm } from './bills-section.js';
import { renderPopup } from './popup.js';
import { getSelectedPeriod, getPeriodLabel } from './period-selector.js';
import { navigateToView } from '../router.js';
import { formatCents } from '../../core/money.js';
import { isOverdue, daysBetween, parseLocalDate } from '../../core/date.js';
import { toggleBillPaidAction, updateBillAction, deleteBillAction, getAllBills } from '../../modules/bills/index.js';
import { getUpcomingBills, getUpcomingBillsTotalCents } from '../../modules/dashboard/index.js';
import { getBillPaymentsForPeriod, getBillPaymentsTotalCents } from '../../modules/bill-payments/index.js';
import { resolvePeriodRange } from '../../modules/expenses/index.js';
import { getUpcomingDebtPayments } from '../../modules/debts/index.js';

// Which bill's edit popup is open on the Bills view — transient UI
// state, deliberately outside the store (docs/ARCHITECTURE.md §4).
let editingBillId = null;

function dueLabel(dateStr, now) {
  const days = daysBetween(now, parseLocalDate(dateStr));
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days > 1) return `Due in ${days} days`;
  return `Due ${dateStr}`;
}

// One row in the compact glance list — a real Bill or a debt's
// minimum-payment. The only differences by kind: the leading icon, and
// the action — a Bill offers "Mark paid" (a one-tap status toggle), a
// debt offers "Make payment" which routes to the Debts view.
function glanceRow({ item, kind, now, dispatch }) {
  const overdue = item.date != null && isOverdue(item.date, now);
  const dateText = item.date == null ? 'No due date' : overdue ? 'Overdue' : dueLabel(item.date, now);
  const iconName = kind === 'debt' ? 'credit-card' : 'file-text';

  return el('div', { class: 'bills-due-soon__row' }, [
    iconChip(iconName, { color: overdue ? 'var(--color-status-attention-text)' : 'var(--color-status-caution-text)' }),
    el('div', { class: 'bills-due-soon__info' }, [
      el('span', { class: 'bills-due-soon__name' }, item.name),
      el('span', { class: `bills-due-soon__date${overdue ? ' bills-due-soon__date--overdue' : ''}` }, dateText),
    ]),
    el('span', { class: 'bills-due-soon__amount' }, formatCents(item.amountCents)),
    kind === 'debt'
      ? el(
          'button',
          { type: 'button', class: 'btn btn--secondary btn--small', onclick: () => navigateToView('debts') },
          'Make payment'
        )
      : el(
          'button',
          { type: 'button', class: 'btn btn--secondary btn--small', onclick: () => dispatch(toggleBillPaidAction(item.id, { now })) },
          'Mark paid'
        ),
  ]);
}

/** Dated soonest-first, undated last — same convention as getUpcomingBills. */
function byDueDate(a, b) {
  if (a.date && b.date) return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  if (a.date && !b.date) return -1;
  if (!a.date && b.date) return 1;
  return 0;
}

const RECURRENCE_META_LABEL = { 'one-time': 'One-time', weekly: 'Weekly', monthly: 'Monthly' };

function manageBillRow({ bill, now, dispatch, requestRender }) {
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

/** Unpaid first, then soonest due date. */
function billSortOrder(a, b) {
  if (!!a.paid !== !!b.paid) return a.paid ? 1 : -1;
  const ad = a.dueDate || '';
  const bd = b.dueDate || '';
  return ad < bd ? -1 : ad > bd ? 1 : 0;
}

/**
 * @param {object} options
 * @param {object} options.state
 * @param {Function} options.dispatch
 * @param {Date} [options.now]
 * @param {() => void} [options.requestRender]
 * @param {boolean} [options.compact] Dashboard summary mode — glance list
 *   + "View all bills →", no management. Default false (the Bills view).
 * @param {() => void} [options.onViewAll] where the "View all bills →"
 *   link goes (compact mode only).
 */
export function renderBillsDueSoon({ state, dispatch, now = new Date(), requestRender, compact = false, onViewAll }) {
  if (compact) {
    // Dashboard summary — the "due soon" glance: nearest unpaid bills +
    // any debt minimum-payment due (docs/PRODUCT.md §8), capped, inside a
    // tinted card. Read-only apart from one-tap "Mark paid".
    const { items: billItems } = getUpcomingBills(state, { limit: 5 });
    const debtItems = getUpcomingDebtPayments(state, { now }).filter((d) => !d.alreadyPaidThisPeriod);
    const combined = [
      ...billItems.map((item) => ({ item, kind: 'bill' })),
      ...debtItems.map((item) => ({ item, kind: 'debt' })),
    ]
      .sort((a, b) => byDueDate(a.item, b.item))
      .slice(0, 4);

    const body =
      combined.length === 0
        ? emptyState('No unpaid bills right now.')
        : el('div', { class: 'bills-due-soon__list' }, combined.map(({ item, kind }) => glanceRow({ item, kind, now, dispatch })));

    const headerAction = onViewAll
      ? el('button', { type: 'button', class: 'link-button', onclick: onViewAll }, 'View all bills →')
      : null;

    return el('section', { class: 'card card--quiet bills-due-soon', 'aria-labelledby': 'bills-due-soon-heading' }, [
      el('div', { class: 'card__header-row' }, [
        sectionHeading('file-text', 'Bills due soon', 'bills-due-soon-heading', { color: 'var(--color-status-caution-text)' }),
        headerAction,
      ].filter(Boolean)),
      body,
    ].filter(Boolean));
  }

  // Full (Bills view): a tinted summary card ("Bills paid" over the
  // selected period, with the outstanding total as its note), then every
  // bill as its own card — Mark paid/unpaid + a pencil to edit (in a
  // popup) + a trash to delete. Unpaid & soonest-due sort to the top.
  const bills = [...getAllBills(state)].sort(billSortOrder);
  const list =
    bills.length > 0
      ? el('ul', { class: 'money-list money-list--cards' }, bills.map((bill) => manageBillRow({ bill, now, dispatch, requestRender })))
      : emptyState('No bills yet — use "+ Add bill" to add your first one.');

  const editing = editingBillId ? bills.find((b) => b.id === editingBillId) : null;
  const closeEdit = () => {
    editingBillId = null;
    requestRender?.();
  };
  const editPopup = editing
    ? renderPopup({
        titleId: 'edit-bill-heading',
        title: 'Edit bill',
        body: renderBillForm({
          bill: editing,
          onSubmit: (changes) => {
            dispatch(updateBillAction(editing.id, changes, { now }));
            closeEdit();
          },
          onCancel: closeEdit,
        }),
        onClose: closeEdit,
      })
    : null;

  return el('div', { class: 'view-stack' }, [renderBillsSummaryCard(state, now), list, editPopup].filter(Boolean));
}

/** The Bills view's global number — bills actually paid (logged as
 *  BillPayments) within the header bar's selected period; the note keeps
 *  the still-outstanding total in view. Tinted like an obligation. */
function renderBillsSummaryCard(state, now) {
  const period = getSelectedPeriod();
  const range = resolvePeriodRange(period.period, { now, from: period.from, to: period.to }) ?? { startDateKey: null, endDateKey: null };
  const paidCents = getBillPaymentsTotalCents(getBillPaymentsForPeriod(state, { startDateKey: range.startDateKey, endDateKey: range.endDateKey }));
  const unpaidCount = getAllBills(state).filter((bill) => bill && bill.active && !bill.paid).length;
  return renderStatCard({
    icon: 'file-text',
    label: `Bills paid · ${getPeriodLabel(period)}`,
    value: formatCents(paidCents),
    note:
      unpaidCount > 0
        ? `${unpaidCount} unpaid · ${formatCents(getUpcomingBillsTotalCents(state))} still to pay`
        : 'All bills are paid.',
    tone: 'attention',
  });
}
