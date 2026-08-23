// The currency picker — in the header bar's right-side controls group,
// next to the period selector and theme toggle (moved there from the
// brand area at the user's explicit follow-up request; see CLAUDE.md
// "Current status" for that history). Purely a *display* preference:
// picking a currency here only changes how src/core/money.js's
// `formatCents` renders amounts everywhere in the app (via
// `setActiveCurrency`, set once per render by src/ui/shell.js). It does
// not convert, store a second currency alongside the first, or touch any
// stored amount — see docs/DATA-MODEL.md "Settings" and money.js's own
// `SUPPORTED_CURRENCIES` comment for the full reasoning.
//
// Same anchored scrim+panel structure as period-selector.js (a
// transparent full-page click-catcher behind the panel, closing on an
// outside click or Escape without a raw `document`-level listener that
// would outlive this render pass) — not sharing code with it beyond that
// established pattern, since a plain currency list has none of
// period-selector's custom-date-range complexity to reuse. Anchored to
// the *right* edge of its toggle (`right: 0`), matching period-selector's
// own panel now that this toggle also lives in the right-side controls
// group, near the right edge of the header bar.
//
// The toggle itself shows the currency *sign* (e.g. "$", "€"), not the
// 3-letter code — a plain `.icon-btn`, not `iconButton()` (icons.js's
// helper always renders a hand-authored SVG glyph; this needs a text
// character instead, so it's built directly here with the same CSS
// class for a visually identical square button).

import { el } from '../dom.js';
import { SUPPORTED_CURRENCIES, getCurrencySymbol } from '../../core/money.js';
import { getCurrency, setCurrencyAction } from '../../modules/settings/index.js';

const CURRENCY_LABEL = {
  USD: 'USD — US Dollar ($)',
  EUR: 'EUR — Euro (€)',
  GBP: 'GBP — British Pound (£)',
  JPY: 'JPY — Japanese Yen (¥)',
  CAD: 'CAD — Canadian Dollar ($)',
  AUD: 'AUD — Australian Dollar ($)',
};

// Whether the dropdown panel is open — transient UI state, deliberately
// outside the store (see docs/ARCHITECTURE.md §4), same convention as
// period-selector.js's own `panelOpen`.
let currencyPanelOpen = false;

/**
 * @param {object} options
 * @param {object} options.state
 * @param {Function} options.dispatch
 * @param {() => void} [options.requestRender]
 */
export function renderCurrencySelector({ state, dispatch, requestRender }) {
  const current = getCurrency(state);

  const toggle = el(
    'button',
    {
      type: 'button',
      class: 'icon-btn currency-selector__toggle',
      'aria-label': `Currency: ${current}. Change display currency.`,
      title: `Currency: ${current}`,
      onclick: () => {
        currencyPanelOpen = !currencyPanelOpen;
        requestRender?.();
      },
    },
    getCurrencySymbol(current)
  );

  const wrapper = el('div', { class: 'currency-selector' }, [toggle]);
  if (!currencyPanelOpen) return wrapper;

  const close = () => {
    currencyPanelOpen = false;
    requestRender?.();
  };

  const options = el(
    'div',
    { class: 'currency-selector__options', role: 'group', 'aria-label': 'Select a display currency' },
    SUPPORTED_CURRENCIES.map((code) =>
      el(
        'button',
        {
          type: 'button',
          class: `currency-selector__option${code === current ? ' currency-selector__option--active' : ''}`,
          onclick: () => {
            dispatch(setCurrencyAction(code));
            close();
          },
        },
        CURRENCY_LABEL[code] ?? code
      )
    )
  );

  const panel = el('div', { class: 'currency-selector__panel', role: 'dialog', 'aria-label': 'Currency' }, [options]);
  const scrim = el('div', { class: 'currency-selector__scrim' }, [panel]);
  scrim.onclick = (event) => {
    if (event.target === scrim) close();
  };
  scrim.onkeydown = (event) => {
    if (event.key === 'Escape') close();
  };

  wrapper.appendChild(scrim);
  return wrapper;
}
