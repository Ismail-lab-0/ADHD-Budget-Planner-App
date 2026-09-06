// ─────────────────────────────────────────────────────────────────────────
//  DEMO BUILD FLAG — the ONE difference between the two shipping builds
// ─────────────────────────────────────────────────────────────────────────
//  DEMO_MODE = true   gated public demo   → dist/index.html   (npm run build:demo)
//  DEMO_MODE = false  full paid version   → dist/full.html    (npm run build:full)
//
//  The committed source value is `false` (the safe one — no restrictions).
//  build/build.js rewrites the emitted flag line to true ONLY when
//  invoked with `--demo`; nothing else about the two bundles differs.
//  `grep "DEMO_MODE =" dist/index.html dist/full.html` to confirm
//  true-in-one / false-in-the-other.
//
//  This module is imported first from src/main.js purely so the flag lands
//  near the top of the built <script>. When DEMO_MODE is false, every
//  export below short-circuits immediately — the guard, the countdown
//  line, and the limit modal are all unreachable and nothing renders.
// ─────────────────────────────────────────────────────────────────────────

import { el } from './dom.js';
import { iconButton } from './components/icons.js';

export const DEMO_MODE = false;
export const DEMO_LIMIT = 25; // most expenses the demo build will create
export const DEMO_WARN_AT = 20; // show the quiet countdown line from here on
export const ETSY_URL = 'https://www.etsy.com/listing/4562403530/adhd-budget-planner-app-safe-to-spend';

/**
 * How many expenses exist right now — read straight off the live store
 * state, which is loaded from (and saved back to) the app's single
 * localStorage key via the storage adapter. NOT a separate counter.
 * @param {object} state
 * @returns {number}
 */
export function demoExpenseCount(state) {
  return Array.isArray(state?.expenses) ? state.expenses.length : 0;
}

/**
 * The single guard every expense-creation path runs through — the Add
 * expense modal (dashboard + Expenses view) and the Brain Dump Inbox's
 * "Convert to expense" flow. Returns true when the create may proceed;
 * returns false AND shows the limit modal when the demo cap is hit.
 * A no-op that always returns true in the full build.
 * @param {object} state
 * @returns {boolean}
 */
export function canAddExpense(state) {
  if (!DEMO_MODE) return true;
  if (demoExpenseCount(state) < DEMO_LIMIT) return true;
  showDemoLimit();
  return false;
}

/**
 * The quiet "5 of 25 demo expenses left" line shown under the dashboard
 * once the count reaches DEMO_WARN_AT. Secondary text, not a banner.
 * Returns null (renders nothing) below the threshold or in the full build.
 * @param {object} state
 * @returns {HTMLElement|null}
 */
export function renderDemoNotice(state) {
  if (!DEMO_MODE) return null;
  const count = demoExpenseCount(state);
  if (count < DEMO_WARN_AT) return null;
  const left = Math.max(0, DEMO_LIMIT - count);
  const text =
    left > 0
      ? `${left} of ${DEMO_LIMIT} demo expenses left`
      : `You've reached the ${DEMO_LIMIT}-expense demo limit`;
  return el('p', { class: 'demo-countdown' }, text);
}

/**
 * The calm, in-app limit modal — the app's own modal styling (cream/green
 * palette, matching typography), never a browser alert. Appended to
 * <body>, so every card behind it stays visible and no data is touched.
 * Closes on the X, a backdrop click, or Escape.
 */
export function showDemoLimit() {
  if (!DEMO_MODE || typeof document === 'undefined') return;
  if (document.getElementById('demo-limit-backdrop')) return; // already open

  const heading = el('h2', { id: 'demo-limit-heading' }, "That's the demo limit");
  const message = el(
    'p',
    { class: 'demo-limit__message' },
    `You've logged ${DEMO_LIMIT} expenses — that's the demo limit. Everything you've entered is still here. The full version has no limit and is yours to keep.`
  );
  const cta = el(
    'a',
    { class: 'btn btn--primary', href: ETSY_URL, target: '_blank', rel: 'noopener noreferrer' },
    'Get the full app'
  );

  const modal = el(
    'div',
    { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'demo-limit-heading' },
    [
      el('div', { class: 'modal__header' }, [heading, iconButton('close', 'Close', closeDemoLimit)]),
      el('div', { class: 'modal__body' }, [message]),
      el('div', { class: 'modal__footer' }, [cta]),
    ]
  );

  const backdrop = el('div', { class: 'modal-backdrop', id: 'demo-limit-backdrop' }, [modal]);
  backdrop.onclick = (event) => {
    if (event.target === backdrop) closeDemoLimit();
  };
  backdrop.onkeydown = (event) => {
    if (event.key === 'Escape') closeDemoLimit();
  };

  document.body.appendChild(backdrop);
  // Lock background scroll. src/ui/shell.js's render() only manages the
  // overflow lock for popups inside <main>; this modal lives on <body>,
  // so it's set here and restored in closeDemoLimit(). A store-driven
  // re-render while the modal is open would clear it — acceptable for a
  // terminal sales moment where nothing else is dispatching.
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    document.body.style.overflow = 'hidden';
    cta.focus();
  });
}

function closeDemoLimit() {
  const backdrop = document.getElementById('demo-limit-backdrop');
  if (backdrop) backdrop.remove();
  document.body.style.overflow = '';
}
