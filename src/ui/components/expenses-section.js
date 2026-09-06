// The Expenses section (Phase 5 — Expense Tracking): a fast add form
// (only amount is required) and a compact recent-expenses list with
// edit/delete — not a full accounting ledger. Categories have sensible
// defaults but are freely editable via a <datalist>, not a locked enum.

import { el } from '../dom.js';
import { emptyState } from './empty-state.js';
import { amountField } from './amount-field.js';
import { renderMoneyItem } from './money-item.js';
import { renderMoreOptions } from './more-options.js';
import { renderStatCard } from './stat-card.js';
import { renderPopup } from './popup.js';
import { getPeriodLabel } from './period-selector.js';
import { icon, iconButton, sectionHeading, categoryIconChip } from './icons.js';
import { formatCents, parseAmountToCents } from '../../core/money.js';
import { getExpensesForPeriod, getExpensesTotalCents, getKnownCategories, updateExpenseAction, deleteExpenseAction } from '../../modules/expenses/index.js';

// Which expense's edit popup is open — transient UI state, deliberately
// outside the store (see docs/ARCHITECTURE.md §4).
let editingExpenseId = null;

/**
 * @param {string|null|undefined} value
 * @param {string[]} knownCategories datalist suggestions — every category
 *   currently "in play" (see getKnownCategories), not a locked list; the
 *   field stays free text, so typing anything else introduces a new
 *   category, known everywhere from then on.
 * @returns {HTMLLabelElement} with `.categoryInput` set to the nested <input>
 */
function categoryField(value, knownCategories) {
  const input = el('input', { type: 'text', name: 'category', class: 'field__input', list: 'expense-categories', value: value || '', placeholder: 'Optional' });
  const datalist = el(
    'datalist',
    { id: 'expense-categories' },
    knownCategories.map((category) => el('option', { value: category }))
  );
  const label = el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'Category'), input, datalist]);
  label.categoryInput = input;
  return label;
}

function dateField(labelText, { name, value }) {
  const input = el('input', { type: 'date', name, value: value || '', class: 'field__input' });
  return el('label', { class: 'field' }, [el('span', { class: 'field__label' }, labelText), input]);
}

function expenseTextField(labelText, { name, value, placeholder }) {
  const input = el('input', { type: 'text', name, value: value || '', class: 'field__input', placeholder });
  return el('label', { class: 'field' }, [el('span', { class: 'field__label' }, labelText), input]);
}

/**
 * The fast-add / edit form: Amount + Category up front, everything else
 * (description/date/notes) behind "+ More options" — Phase 7's explicit
 * fast-path is "+ Add Expense → Amount → Category → Save". Editing starts
 * expanded, since there's nothing to hide once values already exist.
 * Exported for reuse by the hero's inline "+ Add expense" form
 * (src/ui/components/safe-to-spend-hero.js).
 * @param {object} options
 * @param {object} options.state used only to build the category field's
 *   suggestions (`getKnownCategories`) — this form reads no other state.
 * @param {string|null} [options.initialDescription] prefills the
 *   Description field (behind "+ More options") without triggering edit
 *   mode — used by "Convert to expense" (src/ui/components/
 *   inbox-section.js) to seed a Brain Dump note's text as the new
 *   expense's description while keeping the create-mode "+ Add expense"
 *   button/copy, unlike passing a partial `expense` would. Forces "+ More
 *   options" open too, same as edit mode, so the prefilled value is
 *   actually visible rather than hidden behind a collapsed toggle.
 */
export function renderExpenseForm({ state, expense = null, initialDescription = null, onSubmit, onCancel }) {
  const isEdit = expense != null;
  const amount = amountField('Amount', { name: 'amountCents', valueCents: expense?.amountCents ?? null });
  const category = categoryField(expense?.category, getKnownCategories(state));
  const error = el('p', { class: 'field__error', role: 'alert' });

  const more = renderMoreOptions(
    () => [
      expenseTextField('Description', { name: 'description', value: expense?.description ?? initialDescription, placeholder: 'Optional' }),
      dateField('Date', { name: 'date', value: expense?.date }),
      expenseTextField('Notes', { name: 'notes', value: expense?.notes, placeholder: 'Optional' }),
    ],
    { startExpanded: isEdit || initialDescription != null }
  );

  const form = el('form', { class: 'money-form' }, [
    amount,
    category,
    more.toggle,
    more.details,
    error,
    el(
      'div',
      { class: 'money-form__buttons' },
      [
        el('button', { type: 'submit', class: 'btn btn--primary btn--small' }, isEdit ? 'Save' : [icon('receipt'), 'Add expense']),
        isEdit ? el('button', { type: 'button', class: 'btn btn--secondary btn--small', onclick: () => onCancel() }, 'Cancel') : null,
      ].filter(Boolean)
    ),
  ]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const amountCents = parseAmountToCents(amount.amountInput.value);
    if (amountCents == null) {
      error.textContent = 'Enter an amount of 0 or more, like 12.50.';
      return;
    }
    error.textContent = '';

    const formData = new FormData(form);
    const payload = {
      amountCents,
      category: formData.get('category')?.trim() || null,
      description: formData.get('description')?.trim() || null,
      notes: formData.get('notes')?.trim() || null,
    };
    const date = formData.get('date');
    if (date) payload.date = date; // omit when blank so an edit never clobbers it with nothing

    onSubmit(payload);
    if (!isEdit) {
      amount.amountInput.value = '';
      category.categoryInput.value = '';
    }
  });

  return form;
}

/**
 * @param {object} options
 * @param {object} options.state
 * @param {Function} options.dispatch
 * @param {() => void} [options.requestRender]
 * @param {Date} [options.now]
 * @param {{period: string, from: string|null, to: string|null}} options.period
 *   the header bar's global period selector (src/ui/components/
 *   period-selector.js) — the single source of truth for which stretch of
 *   time this list shows.
 * @param {boolean} [options.compact] Dashboard summary mode — a capped,
 *   read-only recent list + "View all expenses →". Default false (the Expenses view).
 * @param {() => void} [options.onViewAll] target of the "View all expenses →" link (compact only).
 */
/** The Dashboard's read-only "Expenses" table — Activity / Category /
 *  Date / Amount, aligned columns, scrollable on a phone rather than
 *  overflowing. */
function renderExpensesTable(expenses) {
  const rows = expenses.map((expense) =>
    el('tr', {}, [
      el('td', { class: 'mini-table__activity' }, [
        categoryIconChip(expense.category, { small: true }),
        el('span', { class: 'mini-table__name' }, expense.description || expense.category || 'Expense'),
      ]),
      el('td', { class: 'mini-table__cat' }, expense.category || '—'),
      el('td', { class: 'mini-table__date' }, expense.date),
      el('td', { class: 'mini-table__amount' }, formatCents(expense.amountCents)),
    ])
  );
  return el('div', { class: 'mini-table__scroll' }, [
    el('table', { class: 'mini-table' }, [
      el('thead', {}, el('tr', {}, [el('th', {}, 'Activity'), el('th', {}, 'Category'), el('th', {}, 'Date'), el('th', { class: 'mini-table__amount' }, 'Amount')])),
      el('tbody', {}, rows),
    ]),
  ]);
}

export function renderExpensesSection({ state, dispatch, requestRender, now = new Date(), period, compact = false, onViewAll }) {
  const allForPeriod = getExpensesForPeriod(state, { period: period.period, from: period.from, to: period.to });
  const expenses = compact ? allForPeriod.slice(0, 6) : allForPeriod;

  if (compact) {
    const body = expenses.length > 0 ? renderExpensesTable(expenses) : emptyState('No spending in that period.');
    const total =
      allForPeriod.length > 0
        ? el('p', { class: 'expenses-filter__total' }, `${formatCents(getExpensesTotalCents(allForPeriod))} · ${allForPeriod.length} expense${allForPeriod.length === 1 ? '' : 's'} this period`)
        : null;
    const headerAction = onViewAll ? el('button', { type: 'button', class: 'link-button', onclick: onViewAll }, 'View all →') : null;
    return el('section', { class: 'card', 'aria-labelledby': 'expenses-heading' }, [
      el('div', { class: 'card__header-row' }, [sectionHeading('receipt', 'Expenses', 'expenses-heading'), headerAction].filter(Boolean)),
      body,
      total,
    ].filter(Boolean));
  }

  const items = expenses.map((expense) => {
    return renderMoneyItem({
      icon: categoryIconChip(expense.category),
      title: expense.description || expense.category || 'Expense',
      meta: [formatCents(expense.amountCents), expense.category, `${expense.date}`],
      // Compact (Dashboard) is a read-only glance — edit/delete live on
      // the Expenses view, as a pencil + trash (same as the Income view).
      actions: compact
        ? []
        : [
            iconButton('edit', `Edit ${expense.description || expense.category || 'expense'}`, () => {
              editingExpenseId = expense.id;
              requestRender?.();
            }),
            iconButton(
              'trash',
              `Delete ${expense.description || expense.category || 'expense'}`,
              () => {
                if (window.confirm('Delete this expense? Its amount will be added back to your current balance.')) {
                  dispatch(deleteExpenseAction(expense.id));
                }
              },
              { tone: 'attention' }
            ),
          ],
    });
  });

  const list = expenses.length > 0 ? el('ul', { class: 'money-list money-list--cards' }, items) : emptyState('No spending in that period.');

  // The one global number for this tab — total spent over the header
  // bar's selected period, replacing the old plain "Total: …" line.
  const summaryCard = renderStatCard({
    icon: 'receipt',
    label: `Spent · ${getPeriodLabel(period)}`,
    value: formatCents(getExpensesTotalCents(allForPeriod)),
    note:
      allForPeriod.length > 0
        ? `${allForPeriod.length} expense${allForPeriod.length === 1 ? '' : 's'}`
        : 'No spending in this period.',
    tone: 'caution',
  });

  const editing = editingExpenseId ? allForPeriod.find((e) => e.id === editingExpenseId) : null;
  const closeEdit = () => {
    editingExpenseId = null;
    requestRender?.();
  };
  const editPopup = editing
    ? renderPopup({
        titleId: 'edit-expense-heading',
        title: 'Edit expense',
        body: renderExpenseForm({
          state,
          expense: editing,
          onSubmit: (changes) => {
            dispatch(updateExpenseAction(editing.id, changes, { now }));
            closeEdit();
          },
          onCancel: closeEdit,
        }),
        onClose: closeEdit,
      })
    : null;

  // No outer container card — the summary card above, then each expense
  // as its own card (`money-list--cards`); the pencil opens an edit
  // popup. The "Expenses" page title lives in the view header.
  return el('div', { class: 'view-stack' }, [summaryCard, list, editPopup].filter(Boolean));
}
