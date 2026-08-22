// The dashboard's header bar: a small brand mark on the left, the global
// period selector + theme toggle on the right. Deliberately not a
// multi-module nav rail — this stays the single-screen Money app it
// already is (see CLAUDE.md "Current status" for why that was a
// considered-and-declined option, not an oversight).

import { el } from '../dom.js';
import { iconChip } from './icons.js';
import { renderPeriodSelector } from './period-selector.js';
import { renderThemeToggle } from './theme-toggle.js';

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

  const controls = el('div', { class: 'header-bar__controls' }, [
    renderPeriodSelector({ value: period, onChange: onPeriodChange, requestRender }),
    renderThemeToggle({ state, dispatch }),
  ]);

  return el('header', { class: 'header-bar' }, [brand, controls]);
}
