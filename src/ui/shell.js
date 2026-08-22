// The UI shell: mounts the single Dashboard screen. See
// docs/ARCHITECTURE.md §6 (`/ui/shell.js`).
//
// There used to be a Dashboard/Money nav with hash-based routing; at the
// user's explicit request that's gone — everything (Safe-to-Spend,
// Income, Bills, Planned Expenses, Category Budgets, Savings, Safety
// Buffer) now lives on one page (src/ui/screens/dashboard.js), so there's
// nothing left to navigate between.

import { el } from './dom.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderOnboarding } from './screens/onboarding.js';
import { hasCompletedOnboarding, getTheme } from '../modules/settings/index.js';

/**
 * @param {object} options
 * @param {HTMLElement} options.container
 * @param {import('../core/store.js').createStore} options.store
 * @param {ReturnType<typeof import('../core/events.js').createEventBus>} [options.bus]
 * @param {boolean} [options.persistenceUnavailable]
 * @returns {{ render: () => void }}
 */
export function mountShell({ container, store, bus, persistenceUnavailable = false }) {
  container.innerHTML = '';

  const banner = persistenceUnavailable
    ? el(
        'p',
        { class: 'app-banner', role: 'status' },
        "Changes won't be saved on this device right now."
      )
    : null;

  const main = el('main', { class: 'app-main', id: 'main-content' });

  if (banner) container.appendChild(banner);
  container.appendChild(main);

  function render() {
    const state = store.getState();
    const screenProps = { state, dispatch: store.dispatch, now: new Date(), requestRender: render };

    // An explicit theme choice overrides the OS; 'system' (the default)
    // removes both classes so src/styles/base.css's `prefers-color-scheme`
    // media query keeps driving it, same as before this existed. A class
    // on <html>, not an attribute — the mechanism the theme system is
    // documented to use (src/styles/base.css).
    const theme = getTheme(state);
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
    document.documentElement.classList.toggle('theme-light', theme === 'light');

    main.innerHTML = '';

    // A brief, skippable first-run flow takes over the whole screen (no
    // other content — one focused task) until finished or skipped. Both
    // are the same one-click action; see src/ui/screens/onboarding.js.
    if (!hasCompletedOnboarding(state)) {
      main.appendChild(renderOnboarding(screenProps));
    } else {
      main.appendChild(renderDashboard(screenProps));
    }

    // Background scroll-lock, derived fresh on every render from whether
    // a popup (src/ui/components/popup.js) is actually present in the
    // rebuilt tree — not tracked via open/close event bookkeeping, which
    // broke the moment a popup's form submitted (closing it through a
    // path that never restored `overflow` — see popup.js's doc comment).
    // Since every dispatch triggers this render regardless of how a
    // popup closed, this one line self-corrects every time.
    document.body.style.overflow = main.querySelector('.modal-backdrop') ? 'hidden' : '';
  }

  store.subscribe(render);
  render();

  return { render };
}
