// A shared popup/modal helper — every "add" form in the app (Quick
// Actions' four buttons, the Safe-to-Spend hero's "+ Add expense") opens
// through this one function, so the open/close/focus/scroll-lock behavior
// only exists once. Built on the modal CSS foundation in
// src/styles/components.css (".modal-backdrop"/".modal", originally laid
// down in Phase 1, first actually used for Quick Actions).

import { el } from '../dom.js';
import { iconButton } from './icons.js';
import { focusFirstField } from './more-options.js';

/**
 * @param {object} options
 * @param {string} options.titleId heading id, for the dialog's aria-labelledby
 * @param {string} options.title
 * @param {HTMLElement} options.body usually a `<form>`
 * @param {() => void} options.onClose called on: the header's close
 *   button, clicking the backdrop itself (not a click that started inside
 *   the popup), or Escape while focus is anywhere inside it.
 * @returns {HTMLElement} append this anywhere — it's `position: fixed`,
 *   so it covers the full viewport regardless of where it sits in the DOM
 *   (verified no ancestor in this codebase sets transform/filter/
 *   will-change, which would otherwise break that).
 */
export function renderPopup({ titleId, title, body, onClose }) {
  // Background scroll-lock is NOT handled here — see src/ui/shell.js's
  // render(), which derives `document.body.style.overflow` fresh on every
  // render from whether a `.modal-backdrop` is actually present in the
  // DOM. An earlier version locked/restored it right here, capturing
  // "the overflow value to restore" in this closure — which broke the
  // moment a caller's form `onSubmit` closed the popup by calling its own
  // local close() directly (every caller's `onSubmit: (input) => {
  // dispatch(...); close(); }` does exactly this) instead of routing
  // through this function's close — that path never restored the
  // overflow, so submitting *any* popup form left scroll permanently
  // locked. Deriving it from DOM presence instead makes it self-correcting
  // regardless of which of the several ways a popup can close.
  const header = el('div', { class: 'modal__header' }, [el('h2', { id: titleId }, title), iconButton('close', 'Close', onClose)]);
  const modal = el(
    'div',
    { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    [header, el('div', { class: 'modal__body' }, [body])]
  );
  const backdrop = el('div', { class: 'modal-backdrop' }, [modal]);
  backdrop.onclick = (event) => {
    if (event.target === backdrop) onClose();
  };
  backdrop.onkeydown = (event) => {
    if (event.key === 'Escape') onClose();
  };

  // This whole tree is still detached at this point — the caller's render
  // pass builds it, then attaches it to `document` in one shot afterward
  // (see src/ui/shell.js's `main.appendChild(...)`). Calling `.focus()`
  // on a detached element is a silent no-op in a real browser, so the
  // focus move has to wait until right after that attach actually
  // happens — one animation frame is enough and keeps this framework-free.
  requestAnimationFrame(() => focusFirstField(modal));

  return backdrop;
}
