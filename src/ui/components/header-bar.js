// The dashboard's header bar: a small brand mark on the left, and on the
// right — "+ Brain dump", the global period selector, the currency
// picker, and the theme toggle. Deliberately not a multi-module nav rail
// — this stays the single-screen Money app it already is (see CLAUDE.md
// "Current status" for why that was a considered-and-declined option,
// not an oversight).

import { el } from '../dom.js';
import { iconChip } from './icons.js';
import { renderPeriodSelector } from './period-selector.js';
import { renderThemeToggle } from './theme-toggle.js';
import { renderCurrencySelector } from './currency-selector.js';
import { renderBrainDumpButton, renderBrainDumpPopup } from './brain-dump.js';

/**
 * @param {object} options
 * @param {object} options.state
 * @param {Function} options.dispatch
 * @param {{period: string, from: string|null, to: string|null}} options.period
 * @param {(next: {period: string, from: string|null, to: string|null}) => void} options.onPeriodChange
 * @param {() => void} [options.requestRender]
 */
export function renderHeaderBar({ state, dispatch, period, onPeriodChange, requestRender }) {
  const brand = el('div', { class: 'header-bar__brand' }, [iconChip('wallet', { small: true }), el('span', { class: 'header-bar__brand-name' }, 'Money')]);

  // "+ Brain dump" is a persistent, always-visible quick-capture button —
  // same header row as the brand mark, on every load, not something that
  // has to be discovered inside a card. Its own popup (rendered below,
  // alongside this header's other elements) is also how the global "N"
  // keyboard shortcut (src/ui/shell.js) surfaces, since both open the same
  // transient state in src/ui/components/brain-dump.js. The currency
  // picker sits here too, alongside the period selector and theme
  // toggle — moved from the brand area at the user's explicit follow-up
  // request (see currency-selector.js's own header comment for that
  // history).
  const controls = el('div', { class: 'header-bar__controls' }, [
    renderBrainDumpButton({ requestRender }),
    renderPeriodSelector({ value: period, onChange: onPeriodChange, requestRender }),
    renderCurrencySelector({ state, dispatch, requestRender }),
    renderThemeToggle({ state, dispatch }),
  ]);

  const brainDumpPopup = renderBrainDumpPopup({ dispatch, requestRender });

  return el('header', { class: 'header-bar' }, [brand, controls, brainDumpPopup].filter(Boolean));
}
