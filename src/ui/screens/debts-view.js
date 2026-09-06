// The Debts view — a dedicated screen for debt tracking. The page shows
// only the information (per-debt progress bars + payoff estimates, a
// one-tap "Make payment" per debt, and "Manage debts" → the full list
// with inline edit/delete); adding is via the green "+ Add debt" button
// in the view header, which opens `renderDebtForm` in a popup. "Make
// payment" logs a real Expense so Current Balance / Safe-to-Spend stay in
// sync (src/modules/debts/payment-effect.js).

import { el } from '../dom.js';
import { renderAppFrame } from '../components/app-frame.js';
import { renderDebtsSection, renderDebtForm } from '../components/debts-section.js';
import { renderPopup } from '../components/popup.js';
import { createDebtAction } from '../../modules/debts/index.js';

// Whether the "Add debt" popup is open — transient UI state (see
// docs/ARCHITECTURE.md §4).
let addDebtOpen = false;

export function renderDebtsView({ state, dispatch, now = new Date(), requestRender }) {
  const close = () => {
    addDebtOpen = false;
    requestRender?.();
  };

  const addButton = el(
    'button',
    { type: 'button', class: 'btn btn--primary btn--small', onclick: () => { addDebtOpen = true; requestRender?.(); } },
    '+ Add debt'
  );

  const section = renderDebtsSection({ state, dispatch, now, requestRender });

  const popup = addDebtOpen
    ? renderPopup({
        titleId: 'add-debt-view-heading',
        title: 'Add debt',
        body: renderDebtForm({ onSubmit: (input) => { dispatch(createDebtAction(input, { now })); close(); } }),
        onClose: close,
      })
    : null;

  return renderAppFrame({
    state,
    dispatch,
    requestRender,
    activeView: 'debts',
    title: 'Debts',
    titleAction: addButton,
    body: el('div', {}, [section, popup].filter(Boolean)),
  });
}
