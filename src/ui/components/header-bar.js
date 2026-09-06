// The app's header bar (rendered on every view via
// src/ui/components/app-frame.js): the mobile hamburger on the left, and
// on the right — "+ Brain dump", the global period selector, the currency
// picker, and the theme toggle. The brand mark deliberately lives *only*
// in the sidebar (src/ui/components/sidebar.js) — it used to also sit
// here, which duplicated it on desktop; removed at the user's request.

import { el } from '../dom.js';
import { icon } from './icons.js';
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
 * @param {() => void} [options.onOpenNav] opens the sidebar as a drawer —
 *   the button is hidden by CSS at desktop width, where the sidebar is
 *   always visible (src/ui/components/sidebar.js).
 * @param {() => void} [options.requestRender]
 */
export function renderHeaderBar({ state, dispatch, period, onPeriodChange, onOpenNav, requestRender }) {
  // Hamburger — mobile only (CSS `display: none` at >= 1024px). On the
  // left, where the brand used to be; the header keeps `justify-content:
  // space-between` so an empty left slot on desktop still right-aligns
  // the controls.
  const menuButton = onOpenNav
    ? el(
        'button',
        { type: 'button', class: 'icon-btn header-bar__menu-btn', 'aria-label': 'Open navigation', 'aria-controls': 'app-sidebar', onclick: onOpenNav },
        icon('menu', { size: 18 })
      )
    : null;
  const brand = el('div', { class: 'header-bar__brand' }, [menuButton].filter(Boolean));

  // "+ Brain dump" is a persistent, always-visible quick-capture button,
  // on every load, not something that has to be discovered inside a card.
  // Its own popup (rendered below, alongside this header's other
  // elements) is also how the global "N" keyboard shortcut
  // (src/ui/shell.js) surfaces, since both open the same transient state
  // in src/ui/components/brain-dump.js. The currency picker sits here
  // too, alongside the period selector and theme toggle.
  const controls = el('div', { class: 'header-bar__controls' }, [
    renderBrainDumpButton({ requestRender }),
    renderPeriodSelector({ value: period, onChange: onPeriodChange, requestRender }),
    renderCurrencySelector({ state, dispatch, requestRender }),
    renderThemeToggle({ state, dispatch }),
  ]);

  const brainDumpPopup = renderBrainDumpPopup({ dispatch, requestRender });

  return el('header', { class: 'header-bar' }, [brand, controls, brainDumpPopup].filter(Boolean));
}
