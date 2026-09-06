// The Bills view — a dedicated screen for bill management. The page shows
// only the information (the "due soon" glance list with one-tap "Mark
// paid", and "Manage bills" → the full list with inline edit/delete);
// adding is via the green "+ Add bill" button in the view header, which
// opens `renderBillForm` in a popup. Same data / actions as the
// Dashboard summary.

import { el } from '../dom.js';
import { renderAppFrame } from '../components/app-frame.js';
import { renderBillsDueSoon } from '../components/bills-due-soon.js';
import { renderBillForm } from '../components/bills-section.js';
import { renderPopup } from '../components/popup.js';
import { createBillAction } from '../../modules/bills/index.js';

// Whether the "Add bill" popup is open — transient UI state (see
// docs/ARCHITECTURE.md §4).
let addBillOpen = false;

export function renderBillsView({ state, dispatch, now = new Date(), requestRender }) {
  const close = () => {
    addBillOpen = false;
    requestRender?.();
  };

  const addButton = el(
    'button',
    { type: 'button', class: 'btn btn--primary btn--small', onclick: () => { addBillOpen = true; requestRender?.(); } },
    '+ Add bill'
  );

  const section = renderBillsDueSoon({ state, dispatch, now, requestRender });

  const popup = addBillOpen
    ? renderPopup({
        titleId: 'add-bill-view-heading',
        title: 'Add bill',
        body: renderBillForm({ onSubmit: (input) => { dispatch(createBillAction(input, { now })); close(); } }),
        onClose: close,
      })
    : null;

  return renderAppFrame({
    state,
    dispatch,
    requestRender,
    activeView: 'bills',
    title: 'Bills',
    titleAction: addButton,
    body: el('div', {}, [section, popup].filter(Boolean)),
  });
}
