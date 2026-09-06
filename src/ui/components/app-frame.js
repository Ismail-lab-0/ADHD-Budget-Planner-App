// The persistent app shell shared by every view (src/ui/screens/*): the
// left sidebar + its mobile scrim, the top header bar, and an optional
// page title, wrapping whatever `body` the current view supplies. Only
// the `body` changes as you navigate — see src/ui/router.js.
//
// Every view screen calls this instead of building the sidebar/header
// itself, so navigation, the collapse toggle, the mobile drawer, and the
// global period selector are wired the same way everywhere in one place.

import { el } from '../dom.js';
import { renderSidebar, isSidebarCollapsed, setSidebarCollapsed, isSidebarDrawerOpen, setSidebarDrawerOpen } from './sidebar.js';
import { renderHeaderBar } from './header-bar.js';
import { getSelectedPeriod, setSelectedPeriod } from './period-selector.js';
import { navigateToView } from '../router.js';

function focusSoon(selector) {
  if (typeof requestAnimationFrame === 'function' && typeof document !== 'undefined') {
    requestAnimationFrame(() => document.querySelector(selector)?.focus());
  }
}

/**
 * @param {object} options
 * @param {object} options.state
 * @param {Function} options.dispatch
 * @param {() => void} options.requestRender
 * @param {string} options.activeView current route id (drives the active sidebar item)
 * @param {string|Node} [options.title] page heading — omitted for the Dashboard's own greeting header
 * @param {string} [options.subtitle]
 * @param {Node} [options.titleAction] a control shown top-right of the
 *   page heading — the Income/Expenses/Bills/Debts views use it for their
 *   green "+ Add" button.
 * @param {Node} options.body the view's content
 * @returns {HTMLElement}
 */
export function renderAppFrame({ state, dispatch, requestRender, activeView, title, subtitle, titleAction, body }) {
  const sidebar = renderSidebar({
    state,
    dispatch,
    requestRender,
    activeView,
    onToggleCollapse: () => {
      setSidebarCollapsed(!isSidebarCollapsed());
      requestRender?.();
      focusSoon('.sidebar__toggle');
    },
    onNavigate: (viewId) => {
      const wasDrawerOpen = isSidebarDrawerOpen();
      setSidebarDrawerOpen(false);
      // Setting the hash fires `hashchange`, which src/ui/shell.js turns
      // into a re-render (+ scroll to top). If we're already on that
      // view, no event fires — re-render here so the drawer still closes.
      const changed = navigateToView(viewId);
      if (!changed) requestRender?.();
      if (wasDrawerOpen) focusSoon('.header-bar__menu-btn');
    },
    onCloseDrawer: () => {
      setSidebarDrawerOpen(false);
      requestRender?.();
      focusSoon('.header-bar__menu-btn');
    },
  });

  const headerBar = renderHeaderBar({
    state,
    dispatch,
    period: getSelectedPeriod(),
    onPeriodChange: (next) => {
      setSelectedPeriod(next);
      requestRender?.();
    },
    // Hamburger — mobile only (CSS hides it at >=1024px, where the rail
    // is always visible).
    onOpenNav: () => {
      setSidebarDrawerOpen(true);
      requestRender?.();
      focusSoon('.sidebar__close');
    },
    requestRender,
  });

  const heading = title
    ? el('header', { class: 'view-header' }, [
        el('div', { class: 'view-header__main' }, [el('h1', {}, title), subtitle ? el('p', { class: 'view-header__subtitle' }, subtitle) : null].filter(Boolean)),
        titleAction || null,
      ].filter(Boolean))
    : null;

  return el('div', { class: 'screen screen--app' }, [
    sidebar.nav,
    sidebar.scrim,
    sidebar.editPopup,
    el('div', { class: 'app-view' }, [headerBar, heading, body].filter(Boolean)),
  ].filter(Boolean));
}
