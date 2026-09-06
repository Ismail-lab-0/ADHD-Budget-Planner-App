// The Settings view — a dedicated screen consolidating the app's
// existing preferences: display name (greeting copy), theme, and display
// currency. These already existed as `settings.*` state (see
// src/modules/settings/) and as scattered header-bar controls; this view
// just gathers them in one place. No new settings are introduced.

import { el } from '../dom.js';
import { renderAppFrame } from '../components/app-frame.js';
import { sectionHeading, icon } from '../components/icons.js';
import { SUPPORTED_CURRENCIES } from '../../core/money.js';
import { getDisplayName, setDisplayNameAction, getTheme, setThemeAction, getCurrency, setCurrencyAction } from '../../modules/settings/index.js';

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function nameSection({ state, dispatch, requestRender }) {
  const input = el('input', {
    type: 'text',
    class: 'field__input',
    placeholder: 'e.g. Ismail',
    value: getDisplayName(state) ?? '',
    'aria-label': 'Display name',
  });
  const status = el('p', { class: 'field__success', role: 'status' });
  const form = el('form', { class: 'money-form' }, [
    input,
    status,
    el('div', { class: 'money-form__buttons' }, [el('button', { type: 'submit', class: 'btn btn--primary btn--small' }, 'Save')]),
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    dispatch(setDisplayNameAction(input.value));
    status.textContent = 'Saved.';
    requestRender?.();
  });
  return el('section', { class: 'card', 'aria-labelledby': 'settings-name-heading' }, [
    sectionHeading('edit', 'Your name', 'settings-name-heading'),
    el('p', { class: 'section-description' }, 'Optional — shown in the dashboard greeting, e.g. "Good morning, Ismail."'),
    form,
  ]);
}

function themeSection({ state, dispatch }) {
  const current = getTheme(state);
  const buttons = THEME_OPTIONS.map((opt) =>
    el(
      'button',
      {
        type: 'button',
        class: `btn btn--small ${opt.value === current ? 'btn--primary' : 'btn--secondary'}`,
        'aria-pressed': String(opt.value === current),
        onclick: () => dispatch(setThemeAction(opt.value)),
      },
      opt.label
    )
  );
  return el('section', { class: 'card', 'aria-labelledby': 'settings-theme-heading' }, [
    sectionHeading('moon', 'Theme', 'settings-theme-heading'),
    el('p', { class: 'section-description' }, '"System" follows your device; Light or Dark override it.'),
    el('div', { class: 'settings-choice' }, buttons),
  ]);
}

function currencySection({ state, dispatch }) {
  const current = getCurrency(state);
  const select = el(
    'select',
    { class: 'field__input', 'aria-label': 'Display currency', onchange: (event) => dispatch(setCurrencyAction(event.target.value)) },
    SUPPORTED_CURRENCIES.map((code) => el('option', { value: code, selected: code === current || undefined }, code))
  );
  return el('section', { class: 'card', 'aria-labelledby': 'settings-currency-heading' }, [
    sectionHeading('wallet', 'Display currency', 'settings-currency-heading'),
    el('p', { class: 'section-description' }, 'Changes only how amounts are shown — no conversion, no exchange rates.'),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'Currency'), select]),
  ]);
}

export function renderSettingsView({ state, dispatch, requestRender }) {
  const body = el('div', { class: 'view-stack settings-view' }, [
    nameSection({ state, dispatch, requestRender }),
    themeSection({ state, dispatch }),
    currencySection({ state, dispatch }),
    el('p', { class: 'privacy-note' }, [icon('shield'), 'Your data stays on this device — private, no accounts.']),
  ]);
  return renderAppFrame({ state, dispatch, requestRender, activeView: 'settings', title: 'Settings', body });
}
