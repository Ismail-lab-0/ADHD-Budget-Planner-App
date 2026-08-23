// "Brain dump" — instant quick-capture for a stray thought, reachable
// from anywhere via the header bar's persistent button or the global "N"
// keyboard shortcut (src/ui/shell.js). Deliberately scoped to money, not
// a general notes/task-capture feature: what this stores is an
// ExpenseDraft (docs/DATA-MODEL.md), an *unconfirmed expense stub* —
// every one either becomes a real Expense via "Convert to expense" (see
// src/ui/components/inbox-section.js, which owns that popup) or is
// dismissed. Nothing here is ever read by Safe-to-Spend directly, same as
// Category Budgets (docs/SAFE-TO-SPEND.md §3b) — see CLAUDE.md's "Current
// status" for the scope conflict this resolved
// (docs/PRODUCT.md §5's "not general task management" non-goal) and why
// it was resolved this way rather than as a standalone Inbox of arbitrary
// notes.

import { el } from '../dom.js';
import { renderPopup } from './popup.js';
import { createExpenseDraftAction } from '../../modules/expense-drafts/index.js';

// Whether the Brain Dump capture popup is open — transient UI state,
// deliberately outside the store (see docs/ARCHITECTURE.md §4).
// `openBrainDumpCapture` is exported (not just the button's own onclick)
// so src/ui/shell.js's global "N" keydown listener can open the same
// popup from anywhere in the app, not only via this file's own button.
let brainDumpOpen = false;

/** @param {() => void} [requestRender] */
export function openBrainDumpCapture(requestRender) {
  brainDumpOpen = true;
  requestRender?.();
}

/** The persistent "+ Brain dump" header button. @param {{requestRender?: () => void}} options */
export function renderBrainDumpButton({ requestRender }) {
  return el(
    'button',
    { type: 'button', class: 'btn btn--secondary btn--small', onclick: () => openBrainDumpCapture(requestRender) },
    '+ Brain dump'
  );
}

function renderCaptureForm({ dispatch, requestRender }) {
  const input = el('input', {
    type: 'text',
    name: 'text',
    class: 'field__input',
    placeholder: "What's on your mind?",
    autocomplete: 'off',
  });
  const label = el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'Note'), input]);

  const form = el('form', { class: 'money-form' }, [
    label,
    el('div', { class: 'money-form__buttons' }, [el('button', { type: 'submit', class: 'btn btn--primary btn--small' }, 'Save')]),
  ]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return; // nothing typed — quietly do nothing, no error, no confirmation step either way
    dispatch(createExpenseDraftAction({ text }, { now: new Date() }));
    // Deliberately no close() call here — per the feature spec, saving
    // clears the field and keeps the popup open for the next thought.
    // `dispatch` above already triggers a full re-render (src/core/
    // store.js notifies subscribers synchronously), which rebuilds this
    // form from scratch — a fresh, empty `input` — and popup.js's own
    // requestAnimationFrame(focusFirstField) refocuses that fresh input
    // automatically, so nothing extra is needed to clear/refocus by hand.
  });

  return form;
}

/** The capture popup itself, or null when closed. @param {{dispatch: Function, requestRender?: () => void}} options */
export function renderBrainDumpPopup({ dispatch, requestRender }) {
  if (!brainDumpOpen) return null;
  const close = () => {
    brainDumpOpen = false;
    requestRender?.();
  };
  return renderPopup({
    titleId: 'brain-dump-heading',
    title: 'Brain dump',
    body: renderCaptureForm({ dispatch, requestRender }),
    onClose: close,
  });
}
