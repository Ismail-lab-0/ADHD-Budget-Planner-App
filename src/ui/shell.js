// The UI shell: mounts the current view into <main> and re-renders it on
// every store change and every route change. See docs/ARCHITECTURE.md §6.
//
// The app is a real multi-view application again (src/ui/router.js): the
// sidebar (src/ui/components/sidebar.js) switches between dedicated
// screens, each of which wraps its content in the shared app frame
// (src/ui/components/app-frame.js — sidebar + header bar). Routing is
// hash-based and completely independent of the store, so switching
// views, refreshing, and Back/Forward never touch application data.

import { el } from './dom.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderIncomeView } from './screens/income-view.js';
import { renderExpensesView } from './screens/expenses-view.js';
import { renderBillsView } from './screens/bills-view.js';
import { renderDebtsView } from './screens/debts-view.js';
import { renderGoalsView } from './screens/goals-view.js';
import { renderCategoriesView } from './screens/categories-view.js';
import { renderSettingsView } from './screens/settings-view.js';
import { renderOnboarding } from './screens/onboarding.js';
import { openBrainDumpCapture } from './components/brain-dump.js';
import { isSidebarDrawerOpen, isSidebarCollapsed } from './components/sidebar.js';
import { getCurrentView, initViewRouter } from './router.js';
import { hasCompletedOnboarding, getTheme, getCurrency } from '../modules/settings/index.js';
import { setActiveCurrency } from '../core/money.js';

// Form fields the global "N" shortcut below must never hijack typing in.
const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

const VIEW_RENDERERS = {
  dashboard: renderDashboard,
  income: renderIncomeView,
  expenses: renderExpensesView,
  bills: renderBillsView,
  debts: renderDebtsView,
  goals: renderGoalsView,
  categories: renderCategoriesView,
  settings: renderSettingsView,
};

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
    // media query keeps driving it. A class on <html>, not an attribute.
    const theme = getTheme(state);
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
    document.documentElement.classList.toggle('theme-light', theme === 'light');

    // Set the active display currency once per render — every `formatCents`
    // call while building the tree below picks it up implicitly. See
    // src/core/money.js's `setActiveCurrency`.
    setActiveCurrency(getCurrency(state));

    main.innerHTML = '';

    // Onboarding takes over the whole screen (no sidebar) until finished
    // or skipped; the route is ignored while it's showing.
    const onboarded = hasCompletedOnboarding(state);
    if (!onboarded) {
      main.appendChild(renderOnboarding(screenProps));
    } else {
      const renderView = VIEW_RENDERERS[getCurrentView()] || renderDashboard;
      main.appendChild(renderView(screenProps));
    }

    // The sidebar (src/ui/components/sidebar.js) is `position: fixed` and
    // its collapsed / drawer-open state is ephemeral module state; the
    // CSS keys off these <body> classes so `.app-main` can offset for the
    // rail and the mobile scrim can show/hide.
    document.body.classList.toggle('has-sidebar', onboarded);
    document.body.classList.toggle('sidebar-collapsed', onboarded && isSidebarCollapsed());
    document.body.classList.toggle('sidebar-drawer-open', onboarded && isSidebarDrawerOpen());

    // Background scroll-lock, derived fresh every render from whether a
    // popup (src/ui/components/popup.js) is present — plus the mobile nav
    // drawer, which locks scroll the same way.
    const lockScroll = main.querySelector('.modal-backdrop') || (onboarded && isSidebarDrawerOpen());
    document.body.style.overflow = lockScroll ? 'hidden' : '';
  }

  // Global "N" shortcut — opens Brain Dump capture from anywhere (the same
  // popup the header's "+ Brain dump" button opens). Attached once, at
  // mount time. Guarded against hijacking typing and against firing
  // during onboarding.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'n' && event.key !== 'N') return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    const isTyping = target instanceof HTMLElement && (TYPING_TAGS.has(target.tagName) || target.isContentEditable);
    if (isTyping) return;
    if (!hasCompletedOnboarding(store.getState())) return;
    event.preventDefault();
    openBrainDumpCapture(render);
  });

  // Route changes (sidebar clicks set location.hash; Back/Forward change
  // it too) re-render and scroll the new view to the top — docs/PRODUCT.md
  // §15/§17. Application data is untouched by any of this.
  initViewRouter(() => {
    render();
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  });

  store.subscribe(render);
  render();

  return { render };
}
