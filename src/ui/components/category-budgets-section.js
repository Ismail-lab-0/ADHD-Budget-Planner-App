// The Categories card — a restored, rebuilt UI for Phase 6/7's Category
// Budgets module (src/modules/category-budgets/), which was never
// deleted, only its dashboard section was, at the user's own earlier
// request (see CLAUDE.md "Current status"). Deliberately has no effect on
// Safe-to-Spend, same as before — see docs/SAFE-TO-SPEND.md §3b.

import { el } from '../dom.js';
import { emptyState } from './empty-state.js';
import { amountField } from './amount-field.js';
import { renderPopup } from './popup.js';
import { sectionHeading, iconButton, categoryEmojiBadge } from './icons.js';
import { formatCents, parseAmountToCents } from '../../core/money.js';
import { getAllCategoryBudgets, getCategoryBudgetProgress, createCategoryBudgetAction, updateCategoryBudgetAction, deleteCategoryBudgetAction } from '../../modules/category-budgets/index.js';
import { getKnownCategories } from '../../modules/expenses/index.js';

// Transient UI state, deliberately outside the store (see
// docs/ARCHITECTURE.md §4) — same convention as every other popup/inline-
// edit toggle in this app.
let manageOpen = false;
let editingId = null;

function miniProgressBar(spentCents, limitCents, status) {
  const percent = limitCents > 0 ? Math.min(Math.max((spentCents / limitCents) * 100, 0), 100) : spentCents > 0 ? 100 : 0;
  const toneClass = status === 'exceeded' ? 'category-row__bar-fill--attention' : status === 'approaching' ? 'category-row__bar-fill--caution' : '';
  return el('div', { class: 'category-row__bar' }, [el('div', { class: `category-row__bar-fill ${toneClass}`.trim(), style: `width: ${percent}%` })]);
}

function categoryRow(progress) {
  const remainingText = progress.remainingCents < 0 ? `${formatCents(Math.abs(progress.remainingCents))} over` : `${formatCents(progress.remainingCents)} left`;
  const remainingClass = progress.remainingCents < 0 ? 'category-row__remaining category-row__remaining--attention' : 'category-row__remaining';

  return el('li', { class: 'category-row' }, [
    categoryEmojiBadge(progress.category),
    el('div', { class: 'category-row__body' }, [
      el('div', { class: 'category-row__top' }, [
        el('span', { class: 'category-row__name' }, progress.category),
        el('span', { class: 'category-row__amounts' }, `${formatCents(progress.spentCents)} of ${formatCents(progress.limitCents)}`),
      ]),
      miniProgressBar(progress.spentCents, progress.limitCents, progress.status),
      el('span', { class: remainingClass }, remainingText),
    ]),
  ]);
}

/**
 * @param {string|null|undefined} value
 * @param {string[]} knownCategories datalist suggestions — every category
 *   currently "in play" (getKnownCategories, shared with the Expense
 *   form's own category field), so you can pick an existing category to
 *   set a limit for instead of retyping it. The field stays free text —
 *   typing anything else adds a new category, known everywhere from then
 *   on (no separate "create a category" step).
 */
function categoryNameField(value, knownCategories) {
  const input = el('input', { type: 'text', name: 'category', class: 'field__input', list: 'category-budget-categories', value: value || '', placeholder: 'e.g. Groceries' });
  const datalist = el(
    'datalist',
    { id: 'category-budget-categories' },
    knownCategories.map((category) => el('option', { value: category }))
  );
  const label = el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'Category'), input, datalist]);
  label.categoryInput = input;
  return label;
}

/**
 * The add/edit form used inside the "Edit categories" popup.
 * @param {object} options
 * @param {object} options.state used only to build the category field's
 *   suggestions (getKnownCategories) — this form reads no other state.
 */
function renderCategoryBudgetForm({ state, categoryBudget = null, onSubmit, onCancel }) {
  const isEdit = categoryBudget != null;
  const category = categoryNameField(categoryBudget?.category, getKnownCategories(state));
  const limit = amountField('Monthly limit', { name: 'limitCents', valueCents: categoryBudget?.limitCents ?? null });
  const error = el('p', { class: 'field__error', role: 'alert' });

  const form = el('form', { class: 'money-form' }, [
    category,
    limit,
    error,
    el('div', { class: 'money-form__buttons' }, [
      el('button', { type: 'submit', class: 'btn btn--primary btn--small' }, isEdit ? 'Save' : 'Add category'),
      isEdit ? el('button', { type: 'button', class: 'btn btn--secondary btn--small', onclick: () => onCancel() }, 'Cancel') : null,
    ].filter(Boolean)),
  ]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const limitCents = parseAmountToCents(limit.amountInput.value);
    const categoryName = category.categoryInput.value.trim();
    if (!categoryName || limitCents == null) {
      error.textContent = 'Enter a category name and a limit of 0 or more, like 150.00.';
      return;
    }
    error.textContent = '';
    onSubmit({ category: categoryName, limitCents });
    if (!isEdit) {
      category.categoryInput.value = '';
      limit.amountInput.value = '';
    }
  });

  return form;
}

function renderManagePopup({ state, dispatch, requestRender, now }) {
  const close = () => {
    manageOpen = false;
    editingId = null;
    requestRender?.();
  };

  const budgets = getAllCategoryBudgets(state);
  const rows = budgets.map((budget) => {
    if (budget.id === editingId) {
      return el('li', { class: 'money-item money-item--editing' }, [
        renderCategoryBudgetForm({
          state,
          categoryBudget: budget,
          onSubmit: (changes) => {
            dispatch(updateCategoryBudgetAction(budget.id, changes, { now }));
            editingId = null;
            requestRender?.();
          },
          onCancel: () => {
            editingId = null;
            requestRender?.();
          },
        }),
      ]);
    }
    return el('li', { class: 'money-item' }, [
      el('div', { class: 'money-item__body' }, [
        el('span', { class: 'money-item__title' }, budget.category),
        el('span', { class: 'money-item__meta-text' }, `${formatCents(budget.limitCents)} / month`),
      ]),
      el('div', { class: 'money-item__actions' }, [
        iconButton('edit', `Edit ${budget.category}`, () => {
          editingId = budget.id;
          requestRender?.();
        }),
        iconButton(
          'trash',
          `Delete ${budget.category}`,
          () => {
            if (window.confirm(`Delete the "${budget.category}" budget? This only removes the limit — nothing you've logged is affected.`)) {
              dispatch(deleteCategoryBudgetAction(budget.id));
            }
          },
          { tone: 'attention' }
        ),
      ]),
    ]);
  });

  const body = el('div', {}, [
    renderCategoryBudgetForm({ state, onSubmit: (input) => dispatch(createCategoryBudgetAction(input, { now })) }),
    budgets.length > 0
      ? el('ul', { class: 'money-list', style: 'margin-top: var(--space-4)' }, rows)
      : emptyState('No categories yet — add one above to start tracking a monthly limit.'),
  ]);

  return renderPopup({ titleId: 'edit-categories-heading', title: 'Edit categories', body, onClose: close });
}

/**
 * @param {object} options
 * @param {object} options.state
 * @param {Function} options.dispatch
 * @param {Date} [options.now]
 * @param {() => void} [options.requestRender]
 */
export function renderCategoryBudgetsSection({ state, dispatch, now = new Date(), requestRender }) {
  const progress = getCategoryBudgetProgress(state, { now });

  const list = progress.length > 0 ? el('ul', { class: 'category-list' }, progress.map(categoryRow)) : emptyState('No budgeted categories yet — add one to see it here.');

  const editLink = el(
    'button',
    {
      type: 'button',
      class: 'link-button',
      onclick: () => {
        manageOpen = true;
        requestRender?.();
      },
    },
    'Edit categories'
  );

  const popup = manageOpen ? renderManagePopup({ state, dispatch, requestRender, now }) : null;

  return el(
    'section',
    { class: 'card', 'aria-labelledby': 'categories-heading' },
    [
      el('div', { class: 'card__header-row' }, [sectionHeading('pie-chart', 'Categories', 'categories-heading'), editLink]),
      list,
      popup,
    ].filter(Boolean)
  );
}
