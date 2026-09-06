// The Categories view — a dedicated screen for Category Budgets. Each
// category is its own card (renderCategoryBudgetsSection non-compact)
// with a pencil (inline edit) + trash; adding is the green "+ Add
// category" button in the view header, which opens renderCategoryBudgetForm
// in a popup. Deliberately no effect on Safe-to-Spend — see
// docs/SAFE-TO-SPEND.md §3b.

import { el } from '../dom.js';
import { renderAppFrame } from '../components/app-frame.js';
import { renderPopup } from '../components/popup.js';
import { renderCategoryBudgetsSection, renderCategoryBudgetForm } from '../components/category-budgets-section.js';
import { createCategoryBudgetAction } from '../../modules/category-budgets/index.js';

// Whether the "Add category" popup is open — transient UI state (see
// docs/ARCHITECTURE.md §4).
let addCategoryOpen = false;

export function renderCategoriesView({ state, dispatch, now = new Date(), requestRender }) {
  const close = () => {
    addCategoryOpen = false;
    requestRender?.();
  };

  const addButton = el(
    'button',
    { type: 'button', class: 'btn btn--primary btn--small', onclick: () => { addCategoryOpen = true; requestRender?.(); } },
    '+ Add category'
  );

  const section = renderCategoryBudgetsSection({ state, dispatch, now, requestRender });

  const popup = addCategoryOpen
    ? renderPopup({
        titleId: 'add-category-heading',
        title: 'Add category',
        body: renderCategoryBudgetForm({
          state,
          onSubmit: (input) => {
            dispatch(createCategoryBudgetAction(input, { now }));
            close();
          },
          onCancel: close,
        }),
        onClose: close,
      })
    : null;

  return renderAppFrame({
    state,
    dispatch,
    requestRender,
    activeView: 'categories',
    title: 'Categories',
    titleAction: addButton,
    body: el('div', {}, [section, popup].filter(Boolean)),
  });
}
