// The Income view — a dedicated screen to view / add / edit / delete
// income and mark it received (docs/PRODUCT.md §10). Built from the
// existing pieces: `renderIncomeForm` (the shared add/edit form) and the
// existing income actions. "Mark received" credits Current Balance and
// logs an IncomeReceipt exactly as it does from the Dashboard's
// "Upcoming income" card — same data, same cross-slice effect
// (src/main.js, docs/DATA-MODEL.md §3a).

import { el } from '../dom.js';
import { renderAppFrame } from '../components/app-frame.js';
import { renderPopup } from '../components/popup.js';
import { renderStatCard } from '../components/stat-card.js';
import { emptyState } from '../components/empty-state.js';
import { iconButton } from '../components/icons.js';
import { renderIncomeForm } from '../components/income-section.js';
import { getSelectedPeriod, getPeriodLabel } from '../components/period-selector.js';
import { formatCents } from '../../core/money.js';
import { getAllIncomes, createIncomeAction, updateIncomeAction, deleteIncomeAction, markIncomeReceivedAction } from '../../modules/incomes/index.js';
import { getIncomeReceiptsForPeriod, getIncomeReceiptsTotalCents } from '../../modules/income-receipts/index.js';
import { resolvePeriodRange } from '../../modules/expenses/index.js';

// Transient UI state (see docs/ARCHITECTURE.md §4): which income row's
// edit popup is open, and whether the "Add income" popup is open.
let editingIncomeId = null;
let addIncomeOpen = false;

const INCOME_VIEW_FREQUENCY_LABEL = { 'one-time': 'One-time', weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly' };

/** The one global number for this tab — income actually received (logged
 *  as IncomeReceipts) within the header bar's selected period. Tinted
 *  teal ("money in"). */
function renderIncomeSummaryCard(state, now, hasIncome) {
  const period = getSelectedPeriod();
  const range = resolvePeriodRange(period.period, { now, from: period.from, to: period.to }) ?? { startDateKey: null, endDateKey: null };
  const receipts = getIncomeReceiptsForPeriod(state, { startDateKey: range.startDateKey, endDateKey: range.endDateKey });
  const note =
    receipts.length > 0
      ? `${receipts.length} payment${receipts.length === 1 ? '' : 's'} received`
      : hasIncome
        ? 'Nothing received in this period — mark income received when it lands.'
        : 'No income yet — add one with "+ Add income".';
  return renderStatCard({
    icon: 'trending-up',
    label: `Received · ${getPeriodLabel(period)}`,
    value: formatCents(getIncomeReceiptsTotalCents(receipts)),
    note,
    tone: 'positive',
  });
}

function incomeViewRow({ income, dispatch, now, requestRender }) {
  const isReceivedOneTime = income.frequency === 'one-time' && income.received;
  const metaParts = [formatCents(income.amountCents), INCOME_VIEW_FREQUENCY_LABEL[income.frequency] ?? 'One-time'];
  if (income.nextDate) metaParts.push(isReceivedOneTime ? 'Received' : `Next ${income.nextDate}`);
  if (!income.active) metaParts.push('Inactive');

  const actions = [];
  if (!isReceivedOneTime && income.active) {
    actions.push(
      el(
        'button',
        { type: 'button', class: 'btn btn--secondary btn--small', onclick: () => dispatch(markIncomeReceivedAction(income.id, { now })) },
        'Mark received'
      )
    );
  }
  actions.push(
    iconButton('edit', `Edit ${income.name}`, () => {
      editingIncomeId = income.id;
      requestRender?.();
    })
  );
  actions.push(
    iconButton(
      'trash',
      `Delete ${income.name}`,
      () => {
        if (window.confirm(`Delete "${income.name}"? This can't be undone.`)) {
          dispatch(deleteIncomeAction(income.id));
        }
      },
      { tone: 'attention' }
    )
  );

  return el('li', { class: 'money-item' }, [
    el('div', { class: 'money-item__body' }, [
      el('span', { class: 'money-item__title' }, income.name),
      el('span', { class: 'money-item__meta-text' }, metaParts.join(' · ')),
    ]),
    el('div', { class: 'money-item__actions' }, actions),
  ]);
}

export function renderIncomeView({ state, dispatch, now = new Date(), requestRender }) {
  const incomes = getAllIncomes(state);
  const close = () => {
    addIncomeOpen = false;
    requestRender?.();
  };

  const addButton = el(
    'button',
    { type: 'button', class: 'btn btn--primary btn--small', onclick: () => { addIncomeOpen = true; requestRender?.(); } },
    '+ Add income'
  );

  // No outer container card — each income entry is its own card
  // (`money-list--cards`), sitting directly on the page. The "Income"
  // page title + "+ Add income" button already live in the view header.
  const list =
    incomes.length > 0
      ? el('ul', { class: 'money-list money-list--cards' }, incomes.map((income) => incomeViewRow({ income, dispatch, now, requestRender })))
      : emptyState('No income yet — use "+ Add income" to add your first one.');

  const popup = addIncomeOpen
    ? renderPopup({
        titleId: 'add-income-view-heading',
        title: 'Add income',
        body: renderIncomeForm({ onSubmit: (input) => { dispatch(createIncomeAction(input, { now })); close(); } }),
        onClose: close,
      })
    : null;

  const editing = editingIncomeId ? incomes.find((i) => i.id === editingIncomeId) : null;
  const closeEdit = () => {
    editingIncomeId = null;
    requestRender?.();
  };
  const editPopup = editing
    ? renderPopup({
        titleId: 'edit-income-heading',
        title: 'Edit income',
        body: renderIncomeForm({
          income: editing,
          onSubmit: (changes) => {
            dispatch(updateIncomeAction(editing.id, changes, { now }));
            closeEdit();
          },
          onCancel: closeEdit,
        }),
        onClose: closeEdit,
      })
    : null;

  return renderAppFrame({
    state,
    dispatch,
    requestRender,
    activeView: 'income',
    title: 'Income',
    titleAction: addButton,
    body: el('div', { class: 'view-stack' }, [renderIncomeSummaryCard(state, now, incomes.length > 0), list, popup, editPopup].filter(Boolean)),
  });
}
