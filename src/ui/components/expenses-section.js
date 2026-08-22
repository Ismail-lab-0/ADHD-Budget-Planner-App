// The Expenses section (Phase 5 — Expense Tracking): a fast add form
// (only amount is required) and a compact recent-expenses list with
// edit/delete — not a full accounting ledger. Categories have sensible
// defaults but are freely editable via a <datalist>, not a locked enum.

import { el } from '../dom.js';
import { emptyState } from './empty-state.js';
import { amountField } from './amount-field.js';
import { renderMoneyItem } from './money-item.js';
import { renderMoreOptions } from './more-options.js';
import { icon, sectionHeading, categoryIconChip } from './icons.js';
import { formatCents, parseAmountToCents } from '../../core/money.js';
import { getExpensesForPeriod, getExpensesTotalCents, getKnownCategories, updateExpenseAction, deleteExpenseAction } from '../../modules/expenses/index.js';

// Which expense row (if any) is being edited inline — transient UI state,
// deliberately outside the store (see docs/ARCHITECTURE.md §4).
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
 */
export function renderExpenseForm({ state, expense = null, onSubmit, onCancel }) {
  const isEdit = expense != null;
  const amount = amountField('Amount', { name: 'amountCents', valueCents: expense?.amountCents ?? null });
  const category = categoryField(expense?.category, getKnownCategories(state));
  const error = el('p', { class: 'field__error', role: 'alert' });

  const more = renderMoreOptions(
    () => [
      expenseTextField('Description', { name: 'description', value: expense?.description, placeholder: 'Optional' }),
      dateField('Date', { name: 'date', value: expense?.date }),
      expenseTextField('Notes', { name: 'notes', value: expense?.notes, placeholder: 'Optional' }),
    ],
    { startExpanded: isEdit }
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
 * @param {{period: string, from: string|null, to: string|null}} options.period
 *   the header bar's global period selector (src/ui/components/
 *   period-selector.js) — the single source of truth for which stretch of
 *   time this list shows; no per-card filter here anymore.
 */
export function renderExpensesSection({ state, dispatch, requestRender, period }) {
  const expenses = getExpensesForPeriod(state, { period: period.period, from: period.from, to: period.to });

  const items = expenses.map((expense) => {
    if (expense.id === editingExpenseId) {
      return el('li', { class: 'money-item money-item--editing' }, [
        renderExpenseForm({
          state,
          expense,
          onSubmit: (changes) => {
            dispatch(updateExpenseAction(expense.id, changes, { now: new Date() }));
            editingExpenseId = null;
            requestRender?.();
          },
          onCancel: () => {
            editingExpenseId = null;
            requestRender?.();
          },
        }),
      ]);
    }
    return renderMoneyItem({
      icon: categoryIconChip(expense.category),
      title: expense.description || expense.category || 'Expense',
      meta: [formatCents(expense.amountCents), expense.category, `${expense.date}`],
      actions: [
        el(
          'button',
          {
            type: 'button',
            class: 'btn btn--secondary btn--small',
            onclick: () => {
              editingExpenseId = expense.id;
              requestRender?.();
            },
          },
          'Edit'
        ),
        el(
          'button',
          {
            type: 'button',
            class: 'btn btn--secondary btn--small',
            onclick: () => {
              if (window.confirm('Delete this expense? Its amount will be added back to your current balance.')) {
                dispatch(deleteExpenseAction(expense.id));
              }
            },
          },
          'Delete'
        ),
      ],
    });
  });

  const list = expenses.length > 0 ? el('ul', { class: 'money-list' }, items) : emptyState('No spending in that period.');

  // Always shown — the header bar's period is always some explicit
  // selection now (no more implicit "Recent" default), so a total is
  // always meaningful.
  const total =
    expenses.length > 0
      ? el('p', { class: 'expenses-filter__total' }, `Total: ${formatCents(getExpensesTotalCents(expenses))} · ${expenses.length} expense${expenses.length === 1 ? '' : 's'}`)
      : null;

  // No add-expense form here — that's the hero's job now (its own inline
  // "+ Add expense" button, src/ui/components/safe-to-spend-hero.js), and
  // no per-card period filter — that's the header bar's job now
  // (src/ui/components/period-selector.js). This section is purely the
  // expenses list + inline edit/delete for whatever period is selected.
  return el(
    'section',
    { class: 'card', 'aria-labelledby': 'expenses-heading' },
    [sectionHeading('receipt', 'Expenses', 'expenses-heading'), total, list].filter(Boolean)
  );
}
