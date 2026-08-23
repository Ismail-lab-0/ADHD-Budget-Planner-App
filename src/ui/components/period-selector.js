// The header bar's global period selector — the single source of truth
// for every period-scoped card (This Period, Expenses). Deliberately NOT
// read by Safe-to-Spend or Current Balance, which are always "right now"
// snapshots (see docs/SAFE-TO-SPEND.md and src/ui/components/
// safe-to-spend-hero.js). The selected period itself is owned by
// src/ui/screens/dashboard.js (the one place that already threads shared
// values down to every card that needs them) and passed in here as a
// controlled `{period, from, to}` + `onChange` — this file only owns
// whether its own dropdown panel is open, which nothing else needs to
// know about.

import { el } from '../dom.js';
import { icon, iconButton } from './icons.js';

export const GLOBAL_PERIODS = ['week', 'month', 'lastMonth', 'all', 'custom'];
const PERIOD_LABEL = { week: 'This week', month: 'This month', lastMonth: 'Last month', all: 'All time', custom: 'Custom range' };

/**
 * The human label for a selected period value — the same text this
 * component already shows in its own toggle button/dropdown, exported so
 * other cards that read the header bar's global period filter (e.g. the
 * "Right now" card, src/ui/components/right-now-section.js) can title
 * themselves with it instead of a static label, without duplicating this
 * mapping.
 * @param {{period: string, from: string|null, to: string|null}} value
 * @returns {string}
 */
export function getPeriodLabel(value) {
  return PERIOD_LABEL[value?.period] ?? 'This month';
}

// Whether the dropdown panel is open — transient UI state, deliberately
// outside the store (see docs/ARCHITECTURE.md §4), same convention as
// every other popup/toggle in this app.
let panelOpen = false;

/**
 * @param {object} options
 * @param {{period: string, from: string|null, to: string|null}} options.value
 * @param {(next: {period: string, from: string|null, to: string|null}) => void} options.onChange
 * @param {() => void} [options.requestRender]
 */
export function renderPeriodSelector({ value, onChange, requestRender }) {
  const toggle = iconButton('calendar', `Filter by period: ${getPeriodLabel(value)}`, () => {
    panelOpen = !panelOpen;
    requestRender?.();
  });
  toggle.classList.add('period-selector__toggle');

  const wrapper = el('div', { class: 'period-selector' }, [toggle]);
  if (!panelOpen) return wrapper;

  const close = () => {
    panelOpen = false;
    requestRender?.();
  };
  const choose = (period) => {
    onChange(period === 'custom' ? { period, from: value.from, to: value.to } : { period, from: null, to: null });
    if (period !== 'custom') close();
    else requestRender?.();
  };

  const options = el(
    'div',
    { class: 'period-selector__options', role: 'group', 'aria-label': 'Select a time period' },
    GLOBAL_PERIODS.map((period) =>
      el(
        'button',
        {
          type: 'button',
          class: `period-selector__option${period === value.period ? ' period-selector__option--active' : ''}`,
          onclick: () => choose(period),
        },
        PERIOD_LABEL[period]
      )
    )
  );

  const children = [options];
  if (value.period === 'custom') {
    const fromInput = el('input', {
      type: 'date',
      class: 'field__input period-selector__date',
      'aria-label': 'From date',
      value: value.from || '',
      onchange: (event) => onChange({ period: 'custom', from: event.target.value || null, to: value.to }),
    });
    const toInput = el('input', {
      type: 'date',
      class: 'field__input period-selector__date',
      'aria-label': 'To date',
      value: value.to || '',
      onchange: (event) => onChange({ period: 'custom', from: value.from, to: event.target.value || null }),
    });
    children.push(el('div', { class: 'period-selector__custom-range' }, [fromInput, el('span', {}, 'to'), toInput]));
  }

  // Same sibling scrim+panel structure as src/ui/components/popup.js (a
  // transparent full-page click-catcher behind an anchored panel, instead
  // of popup.js's centered dark backdrop) — closes on a click anywhere
  // outside the panel, or Escape, without a raw `document`-level listener
  // that would outlive this render pass.
  const panel = el('div', { class: 'period-selector__panel', role: 'dialog', 'aria-label': 'Period filter' }, children);
  const scrim = el('div', { class: 'period-selector__scrim' }, [panel]);
  scrim.onclick = (event) => {
    if (event.target === scrim) close();
  };
  scrim.onkeydown = (event) => {
    if (event.key === 'Escape') close();
  };

  wrapper.appendChild(scrim);
  return wrapper;
}

/** @returns {{period: string, from: string|null, to: string|null}} a sensible starting selection — "This month." */
export function getDefaultPeriodValue() {
  return { period: 'month', from: null, to: null };
}
