// The Categories card — a UI for Phase 6/7's Category Budgets module
// (src/modules/category-budgets/). Deliberately has no effect on
// Safe-to-Spend — see docs/SAFE-TO-SPEND.md §3b.
//
// Two modes:
//   - compact (Dashboard "Budget progress" card): the per-category
//     progress list inside one card + a "View all categories →" link.
//     Read-only.
//   - full (the Categories view, src/ui/screens/categories-view.js): each
//     category is its own card (`.category-list--cards`) with a pencil
//     (inline edit) + trash — the same row shape as the Debts / Goals
//     views. Adding is the view-header's "+ Add category" button
//     (categories-view.js).

import { el } from '../dom.js';
import { emptyState } from './empty-state.js';
import { amountField } from './amount-field.js';
import { renderPopup } from './popup.js';
import { sectionHeading, iconButton, categoryEmojiBadge } from './icons.js';
import { formatCents, parseAmountToCents } from '../../core/money.js';
import { getAllCategoryBudgets, getCategoryBudgetProgress, updateCategoryBudgetAction, deleteCategoryBudgetAction } from '../../modules/category-budgets/index.js';
import { getKnownCategories } from '../../modules/expenses/index.js';

// Which category's edit popup is open — transient UI state, deliberately
// outside the store (see docs/ARCHITECTURE.md §4).
let editingId = null;

function miniProgressBar(spentCents, limitCents, status) {
  const percent = limitCents > 0 ? Math.min(Math.max((spentCents / limitCents) * 100, 0), 100) : spentCents > 0 ? 100 : 0;
  const toneClass = status === 'exceeded' ? 'category-row__bar-fill--attention' : status === 'approaching' ? 'category-row__bar-fill--caution' : '';
  return el('div', { class: 'category-row__bar' }, [el('div', { class: `category-row__bar-fill ${toneClass}`.trim(), style: `width: ${percent}%` })]);
}

function categoryRow({ progress, dispatch, requestRender, compact }) {
  const remainingText = progress.remainingCents < 0 ? `${formatCents(Math.abs(progress.remainingCents))} over` : `${formatCents(progress.remainingCents)} left`;
  const remainingClass = progress.remainingCents < 0 ? 'category-row__remaining category-row__remaining--attention' : 'category-row__remaining';

  const body = [
    el('div', { class: 'category-row__top' }, [
      el('span', { class: 'category-row__name' }, progress.category),
      el('span', { class: 'category-row__amounts' }, `${formatCents(progress.spentCents)} of ${formatCents(progress.limitCents)}`),
    ]),
    miniProgressBar(progress.spentCents, progress.limitCents, progress.status),
    el('span', { class: remainingClass }, remainingText),
  ];

  const actions = compact
    ? null
    : el('div', { class: 'category-row__actions' }, [
        iconButton('edit', `Edit ${progress.category}`, () => {
          editingId = progress.id;
          requestRender?.();
        }),
        iconButton(
          'trash',
          `Delete ${progress.category}`,
          () => {
            if (window.confirm(`Delete the "${progress.category}" budget? This only removes the limit — nothing you've logged is affected.`)) {
              dispatch(deleteCategoryBudgetAction(progress.id));
            }
          },
          { tone: 'attention' }
        ),
      ]);

  return el('li', { class: 'category-row' }, [categoryEmojiBadge(progress.category), el('div', { class: 'category-row__body' }, body), actions].filter(Boolean));
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
 * The add/edit form for a category budget. Exported so the Categories
 * view (src/ui/screens/categories-view.js) can open it in an "+ Add
 * category" popup; also used inline for per-card editing here.
 * @param {object} options
 * @param {object|null} [options.state] used to build the category field's
 *   suggestions (getKnownCategories); pass an explicit `knownCategories`
 *   array instead when `state` isn't available (the inline edit path).
 * @param {string[]} [options.knownCategories]
 */
export function renderCategoryBudgetForm({ state, categoryBudget = null, knownCategories, onSubmit, onCancel }) {
  const isEdit = categoryBudget != null;
  const suggestions = knownCategories ?? getKnownCategories(state);
  const category = categoryNameField(categoryBudget?.category, suggestions);
  const limit = amountField('Monthly limit', { name: 'limitCents', valueCents: categoryBudget?.limitCents ?? null });
  const error = el('p', { class: 'field__error', role: 'alert' });

  const form = el('form', { class: 'money-form' }, [
    category,
    limit,
    error,
    el('div', { class: 'money-form__buttons' }, [
      el('button', { type: 'submit', class: 'btn btn--primary btn--small' }, isEdit ? 'Save' : 'Add category'),
      onCancel ? el('button', { type: 'button', class: 'btn btn--secondary btn--small', onclick: () => onCancel() }, 'Cancel') : null,
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

/**
 * @param {object} options
 * @param {object} options.state
 * @param {Function} options.dispatch
 * @param {Date} [options.now]
 * @param {() => void} [options.requestRender]
 * @param {boolean} [options.compact] Dashboard summary mode — progress
 *   list inside one card + "View all categories →". Default false (the
 *   Categories view: each category its own card + inline edit/delete).
 * @param {() => void} [options.onViewAll] target of the "View all categories →" link (compact only).
 */
export function renderCategoryBudgetsSection({ state, dispatch, now = new Date(), requestRender, compact = false, onViewAll }) {
  const progress = getCategoryBudgetProgress(state, { now });

  if (compact) {
    const list =
      progress.length > 0
        ? el('ul', { class: 'category-list' }, progress.map((p) => categoryRow({ progress: p, dispatch, requestRender, compact: true })))
        : emptyState('No budgeted categories yet — add one to see it here.');
    const headerAction = onViewAll ? el('button', { type: 'button', class: 'link-button', onclick: onViewAll }, 'View all categories →') : null;
    return el('section', { class: 'card', 'aria-labelledby': 'categories-heading' }, [
      el('div', { class: 'card__header-row' }, [sectionHeading('pie-chart', 'Categories', 'categories-heading'), headerAction].filter(Boolean)),
      list,
    ].filter(Boolean));
  }

  // Full (Categories view): no outer container card — each category is
  // its own card with a pencil (opens an edit popup) + trash.
  const list =
    progress.length > 0
      ? el('ul', { class: 'category-list category-list--cards' }, progress.map((p) => categoryRow({ progress: p, dispatch, requestRender, compact: false })))
      : emptyState('No categories yet — use "+ Add category" to set your first monthly limit.');

  const editing = editingId ? progress.find((p) => p.id === editingId) : null;
  const closeEdit = () => {
    editingId = null;
    requestRender?.();
  };
  const editPopup = editing
    ? renderPopup({
        titleId: 'edit-category-heading',
        title: 'Edit category',
        body: renderCategoryBudgetForm({
          state,
          categoryBudget: { id: editing.id, category: editing.category, limitCents: editing.limitCents },
          onSubmit: (changes) => {
            dispatch(updateCategoryBudgetAction(editing.id, changes, { now }));
            closeEdit();
          },
          onCancel: closeEdit,
        }),
        onClose: closeEdit,
      })
    : null;

  return el('div', { class: 'view-stack' }, [list, editPopup].filter(Boolean));
}
