// Left sidebar navigation for the multi-view app. Each item is a distinct
// destination — a hash route (src/ui/router.js), not a scroll anchor.
// The main content area swaps completely between views; the sidebar and
// the header bar are the persistent app shell (composed by
// src/ui/components/app-frame.js).
//
// Desktop: a fixed left rail, collapsible to icons-only (tooltips via
// `title`). Mobile (<1024px): off-canvas, opened as a drawer by the
// header bar's hamburger (src/ui/components/header-bar.js), auto-closing
// on selection. The collapsed / drawer-open flags are ephemeral
// module-level state — the same convention every other UI toggle in this
// app uses (resets on reload); nothing here touches the store or
// localStorage. The active item is driven by the current route, passed
// in as `activeView`.

import { el } from '../dom.js';
import { icon } from './icons.js';
import { renderBrandMark } from './brand.js';
import { renderEditTotalForm } from './single-value-section.js';
import { renderPopup } from './popup.js';
import { formatCents, parseAmountToCents, parseBalanceToCents } from '../../core/money.js';
import { getCurrentBalanceCents, setCurrentBalanceAction, getSavingsAllocationCents, setSavingsAllocationAction, addToSavingsAction } from '../../modules/budget/index.js';

// id: the route id (src/ui/router.js APP_VIEWS) and the `data-view` hook.
// label/iconName: what's shown. group: the section header it sits under.
export const SIDEBAR_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', iconName: 'home', group: 'Main' },
  { id: 'income', label: 'Income', iconName: 'trending-up', group: 'Money' },
  { id: 'expenses', label: 'Expenses', iconName: 'receipt', group: 'Money' },
  { id: 'bills', label: 'Bills', iconName: 'file-text', group: 'Money' },
  { id: 'debts', label: 'Debts', iconName: 'credit-card', group: 'Money' },
  { id: 'goals', label: 'Goals', iconName: 'target', group: 'Planning' },
  { id: 'categories', label: 'Categories', iconName: 'pie-chart', group: 'Planning' },
  { id: 'settings', label: 'Settings', iconName: 'settings', group: 'Other' },
];

// ---- ephemeral view state (see file header) ----
let sidebarCollapsed = false;
let sidebarDrawerOpen = false;
// Which figure's edit popup is open in the footer card ('balance' |
// 'savings' | null) — Current Balance and Savings moved here from the
// former Budget tab (docs/ARCHITECTURE.md, CLAUDE.md "Current status").
let sidebarEditTarget = null;

export function isSidebarCollapsed() {
  return sidebarCollapsed;
}
export function setSidebarCollapsed(next) {
  sidebarCollapsed = Boolean(next);
}
export function isSidebarDrawerOpen() {
  return sidebarDrawerOpen;
}
export function setSidebarDrawerOpen(next) {
  sidebarDrawerOpen = Boolean(next);
}

function navButton({ item, activeView, onNavigate }) {
  const isActive = item.id === activeView;
  const btn = el(
    'button',
    {
      type: 'button',
      class: `sidebar__link${isActive ? ' sidebar__link--active' : ''}`,
      'data-view': item.id,
      'aria-label': item.label,
      title: item.label,
      onclick: () => onNavigate(item.id),
    },
    [icon(item.iconName, { size: 18 }), el('span', { class: 'sidebar__label' }, item.label)]
  );
  if (isActive) btn.setAttribute('aria-current', 'page');
  return btn;
}

function navGroup({ name, items, activeView, onNavigate }) {
  return el('div', { class: 'sidebar__group', role: 'group', 'aria-label': name }, [
    el('p', { class: 'sidebar__group-label' }, name),
    ...items.map((item) => navButton({ item, activeView, onNavigate })),
  ]);
}

/**
 * The compact info card at the bottom of the rail — Current Balance and
 * Savings, read-out with a pencil each that opens a small edit popup
 * (`renderEditTotalForm`). Hidden on the collapsed icon rail (CSS). These
 * two used to be full cards on the Budget tab, which is now the Goals tab.
 */
function renderSidebarFooter({ state, requestRender }) {
  const iconBtn = (className, iconName, aria, target) =>
    el(
      'button',
      {
        type: 'button',
        class: className,
        'aria-label': aria,
        title: aria,
        onclick: () => {
          sidebarEditTarget = target;
          requestRender?.();
        },
      },
      [icon(iconName, { size: 14 })]
    );

  const stat = (key, iconName, label, valueCents, extraButtons = []) =>
    el('div', { class: 'sidebar__stat' }, [
      el('span', { class: 'sidebar__stat-label' }, [icon(iconName, { size: 13 }), el('span', {}, label)]),
      el('div', { class: 'sidebar__stat-line' }, [
        el('span', { class: 'sidebar__stat-value' }, formatCents(valueCents)),
        ...extraButtons,
        iconBtn('sidebar__stat-edit', 'edit', `Edit ${label.toLowerCase()}`, key),
      ]),
    ]);

  return el('div', { class: 'sidebar__stats' }, [
    stat('balance', 'wallet', 'Current balance', getCurrentBalanceCents(state)),
    stat('savings', 'target', 'Savings', getSavingsAllocationCents(state), [
      // A real transfer: moving money into savings debits Current Balance
      // (src/main.js `budget/add-to-savings`). The pencil above only
      // corrects the figure, no balance effect. See docs/SAFE-TO-SPEND.md §9.
      iconBtn('sidebar__stat-edit', 'plus', 'Add to savings', 'savings-add'),
    ]),
  ]);
}

function renderSidebarEditPopup({ state, dispatch, requestRender }) {
  if (sidebarEditTarget == null) return null;
  const isBalance = sidebarEditTarget === 'balance';
  const isSavingsAdd = sidebarEditTarget === 'savings-add';
  const close = () => {
    sidebarEditTarget = null;
    requestRender?.();
  };

  let form;
  let popupTitle;
  if (isSavingsAdd) {
    // A contribution — moves money into savings. `budget/add-to-savings`
    // (src/main.js) raises the Savings figure AND debits Current Balance
    // by the same amount, so Safe-to-Spend drops accordingly.
    popupTitle = 'Add to savings';
    form = renderEditTotalForm({
      title: 'Amount to move into savings',
      valueCents: 0,
      startEmpty: true,
      submitLabel: 'Add',
      parse: parseAmountToCents,
      errorText: 'Enter an amount of 0 or more, like 150.00.',
      hint: 'This moves money out of your current balance and into savings — your safe-to-spend drops by this amount.',
      onSave: (cents) => {
        dispatch(addToSavingsAction(cents));
        close();
      },
    });
  } else {
    popupTitle = isBalance ? 'Edit current balance' : 'Edit savings';
    form = renderEditTotalForm({
      title: isBalance ? 'Current balance' : 'Savings',
      valueCents: isBalance ? getCurrentBalanceCents(state) : getSavingsAllocationCents(state),
      parse: isBalance ? parseBalanceToCents : parseAmountToCents,
      errorText: isBalance ? 'Enter a valid amount, like 150.00 or -40.00.' : 'Enter an amount of 0 or more, like 150.00.',
      hint: isBalance ? null : 'This just corrects the recorded figure — it doesn’t move any money, so your balance and safe-to-spend don’t change.',
      onSave: (cents) => {
        dispatch(isBalance ? setCurrentBalanceAction(cents) : setSavingsAllocationAction(cents));
        close();
      },
    });
  }

  return renderPopup({
    titleId: 'sidebar-edit-heading',
    title: popupTitle,
    body: form,
    onClose: close,
  });
}

/**
 * @param {object} options
 * @param {object} options.state used only by the footer card (Current
 *   Balance / Savings read-out + their edit popups)
 * @param {Function} options.dispatch
 * @param {() => void} options.requestRender
 * @param {string} options.activeView the current route id — the item that renders as active
 * @param {() => void} options.onToggleCollapse desktop collapse/expand
 * @param {(viewId: string) => void} options.onNavigate item selected
 * @param {() => void} options.onCloseDrawer mobile drawer dismissed
 * @returns {{ nav: HTMLElement, scrim: HTMLElement, editPopup: HTMLElement|null }}
 *   append all three to the screen root. The scrim + editPopup are
 *   `position: fixed`; the popup is returned separately (not nested in
 *   `nav`) so a transformed mobile drawer can't clip its backdrop.
 */
export function renderSidebar({ state, dispatch, requestRender, activeView, onToggleCollapse, onNavigate, onCloseDrawer }) {
  const groups = [];
  const seen = new Set();
  for (const item of SIDEBAR_ITEMS) {
    if (seen.has(item.group)) continue;
    seen.add(item.group);
    groups.push(navGroup({ name: item.group, items: SIDEBAR_ITEMS.filter((x) => x.group === item.group), activeView, onNavigate }));
  }

  const collapseToggle = el(
    'button',
    {
      type: 'button',
      class: 'icon-btn sidebar__toggle',
      'aria-label': sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar',
      'aria-expanded': String(!sidebarCollapsed),
      title: sidebarCollapsed ? 'Expand' : 'Collapse',
      onclick: onToggleCollapse,
    },
    icon(sidebarCollapsed ? 'chevron-right' : 'chevron-left', { size: 18 })
  );

  const closeButton = el(
    'button',
    { type: 'button', class: 'icon-btn sidebar__close', 'aria-label': 'Close navigation', onclick: onCloseDrawer },
    icon('close', { size: 18 })
  );

  const brand = el('div', { class: 'sidebar__brand' }, [renderBrandMark()]);

  const nav = el(
    'nav',
    { class: 'sidebar', id: 'app-sidebar', 'aria-label': 'Primary' },
    [
      el('div', { class: 'sidebar__top' }, [brand, collapseToggle, closeButton]),
      el('div', { class: 'sidebar__nav' }, groups),
      renderSidebarFooter({ state, requestRender }),
    ]
  );

  // Escape closes the drawer when focus is inside it (mobile). Harmless
  // on desktop, where the sidebar is always open.
  nav.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebarDrawerOpen) onCloseDrawer();
  });

  const scrim = el('div', { class: 'sidebar-scrim', 'aria-hidden': 'true', onclick: onCloseDrawer });
  const editPopup = renderSidebarEditPopup({ state, dispatch, requestRender });

  return { nav, scrim, editPopup };
}
