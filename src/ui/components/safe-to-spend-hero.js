// The hero card — the single most important thing on the dashboard
// (Phase 4 "primary objective": understand financial position in ~5
// seconds). Renders straight from the engine's result object; computes
// no money math of its own — the "committed vs. available" progress bar
// uses `result.totalCommittedCents`, which the engine already computes
// (see docs/SAFE-TO-SPEND.md §11b), never re-derived here.

import { el } from '../dom.js';
import { iconChip } from './icons.js';
import { renderExpenseForm } from './expenses-section.js';
import { renderPopup } from './popup.js';
import { createExpenseAction } from '../../modules/expenses/index.js';
import { formatCents } from '../../core/money.js';
import { SAFE_TO_SPEND_LABEL, PLANNING_DISCLAIMER, getSafeToSpendMessage } from '../../modules/safe-to-spend/index.js';

const DEFAULT_DESCRIPTION = "You're good — this is what's left after your planned commitments.";

// Whether the hero's "+ Add expense" popup is open — transient UI state,
// deliberately outside the store (see docs/ARCHITECTURE.md §4). Current
// Balance has its own standalone card again (src/ui/screens/dashboard.js
// — see CLAUDE.md "Current status"), not shown here at all anymore.
let expenseFormOpen = false;

/** "$X committed of $Y available" — a different view of numbers the engine
 * already returns, not a new calculation (see docs/SAFE-TO-SPEND.md §11b). */
function renderCommittedProgress(result) {
  const available = result.currentBalanceCents;
  const committed = result.totalCommittedCents;
  const percent = available <= 0 ? (committed > 0 ? 100 : 0) : Math.min(Math.max((committed / available) * 100, 0), 100);
  const trackClass = result.isNegative ? 'hero__progress hero__progress--negative' : 'hero__progress';

  return el('div', { class: trackClass }, [
    el('div', { class: 'hero__progress-track' }, [el('div', { class: 'hero__progress-fill', style: `width: ${percent}%` })]),
    el('div', { class: 'hero__progress-labels' }, [
      el('span', {}, `${formatCents(committed)} committed`),
      el('span', {}, `of ${formatCents(available)} available`),
    ]),
  ]);
}

/**
 * @param {ReturnType<typeof import('../../modules/safe-to-spend/index.js').getSafeToSpend>} result
 * @param {{state: object, dispatch: Function, requestRender?: () => void}} options
 *   `state` is only threaded through to the "+ Add expense" popup's
 *   category field suggestions (`getKnownCategories`) — nothing else here
 *   reads it.
 */
export function renderSafeToSpendHero(result, { state, dispatch, requestRender } = {}) {
  const description = getSafeToSpendMessage(result) ?? DEFAULT_DESCRIPTION;
  const amountClass = result.isNegative ? 'hero__amount hero__amount--negative' : 'hero__amount';

  const heroToneColor = result.isNegative ? 'var(--color-status-attention-text)' : 'var(--color-status-positive-text)';

  let cta = null;
  let popup = null;
  if (dispatch) {
    const closeExpenseForm = () => {
      expenseFormOpen = false;
      requestRender?.();
    };
    cta = el(
      'div',
      { class: 'hero__cta' },
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn--primary',
          onclick: () => {
            expenseFormOpen = true;
            requestRender?.();
          },
        },
        '+ Add expense'
      )
    );
    if (expenseFormOpen) {
      const form = renderExpenseForm({ state, onSubmit: (input) => { dispatch(createExpenseAction(input, { now: new Date() })); closeExpenseForm(); } });
      popup = renderPopup({ titleId: 'hero-add-expense-heading', title: 'Add expense', body: form, onClose: closeExpenseForm });
    }
  }

  return el('section', { class: 'card hero', 'aria-labelledby': 'safe-to-spend-heading' }, [
    el('div', { class: 'hero__icon' }, [iconChip('trending-up', { color: heroToneColor })]),
    el('h2', { class: 'hero__label', id: 'safe-to-spend-heading' }, SAFE_TO_SPEND_LABEL),
    el('p', { class: amountClass }, formatCents(result.safeToSpendCents)),
    el('p', { class: 'hero__description' }, description),
    renderCommittedProgress(result),
    cta,
    el('p', { class: 'hero__disclaimer' }, PLANNING_DISCLAIMER),
    popup,
  ].filter(Boolean));
}
