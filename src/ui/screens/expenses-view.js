// The Expenses view — a dedicated screen for expense tracking. The page
// shows only the information (the period-filtered list with inline
// edit/delete + a total); adding is via the green "+ Add expense" button
// in the view header, which opens the existing `renderExpenseForm` in a
// popup. Same data / actions / calculations as everywhere else.

import { el } from '../dom.js';
import { renderAppFrame } from '../components/app-frame.js';
import { renderExpensesSection, renderExpenseForm } from '../components/expenses-section.js';
import { renderPopup } from '../components/popup.js';
import { getSelectedPeriod } from '../components/period-selector.js';
import { createExpenseAction } from '../../modules/expenses/index.js';
import { canAddExpense } from '../demo-gate.js';

// Whether the "Add expense" popup is open — transient UI state (see
// docs/ARCHITECTURE.md §4).
let addExpenseOpen = false;

export function renderExpensesView({ state, dispatch, now = new Date(), requestRender }) {
  const close = () => {
    addExpenseOpen = false;
    requestRender?.();
  };

  const addButton = el(
    'button',
    { type: 'button', class: 'btn btn--primary btn--small', onclick: () => { addExpenseOpen = true; requestRender?.(); } },
    '+ Add expense'
  );

  const section = renderExpensesSection({ state, dispatch, now, requestRender, period: getSelectedPeriod() });

  const popup = addExpenseOpen
    ? renderPopup({
        titleId: 'add-expense-view-heading',
        title: 'Add expense',
        body: renderExpenseForm({ state, onSubmit: (input) => {
          if (!canAddExpense(state)) { close(); return; }
          dispatch(createExpenseAction(input, { now }));
          close();
        } }),
        onClose: close,
      })
    : null;

  return renderAppFrame({
    state,
    dispatch,
    requestRender,
    activeView: 'expenses',
    title: 'Expenses',
    titleAction: addButton,
    body: el('div', {}, [section, popup].filter(Boolean)),
  });
}
