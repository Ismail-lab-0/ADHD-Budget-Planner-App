// A "+ More options" progressive-disclosure wrapper (Phase 7 — "is the
// user being asked to make unnecessary decisions?"). Secondary fields
// stay out of the way for the common fast-capture case; editing an
// existing record starts expanded, since there's nothing to hide once
// values are already set.

import { el } from '../dom.js';

const FOCUSABLE_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

/** Depth-first search for the first focusable field, so opening "+ More
 * options" (or a modal — see src/ui/components/popup.js) via
 * keyboard/click lands focus where the user is about to type next, instead
 * of leaving it stranded on the now-hidden/closed trigger. */
export function focusFirstField(container) {
  for (const child of container.children ?? []) {
    if (FOCUSABLE_TAGS.has(child.tagName)) {
      child.focus?.();
      return true;
    }
    if (focusFirstField(child)) return true;
  }
  return false;
}

/**
 * @param {() => HTMLElement[]} buildFields called once per paint to build
 *   the secondary fields — a function, not a static array, so it can
 *   close over live input values if ever needed.
 * @param {{startExpanded?: boolean}} [options]
 * @returns {{ toggle: HTMLElement, details: HTMLElement }} append both to
 *   the form; `toggle` hides itself once expanded.
 */
export function renderMoreOptions(buildFields, { startExpanded = false } = {}) {
  let expanded = startExpanded;
  const details = el('div', { class: 'money-form__details' });
  const toggle = el('button', { type: 'button', class: 'btn btn--secondary btn--small money-form__toggle' }, '+ More options');

  function paint() {
    details.innerHTML = '';
    if (expanded) {
      for (const field of buildFields()) details.appendChild(field);
      toggle.hidden = true;
      details.hidden = false;
    } else {
      toggle.hidden = false;
      details.hidden = true;
    }
  }

  toggle.onclick = () => {
    expanded = true;
    paint();
    focusFirstField(details);
  };
  paint();

  return { toggle, details };
}
