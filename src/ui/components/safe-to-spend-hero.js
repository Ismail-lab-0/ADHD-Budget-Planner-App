// The hero card — the single most important thing on the dashboard
// (Phase 4 "primary objective": understand financial position in ~5
// seconds). Computes no money math of its own — every figure (the
// amount, the progress bar, the "How is this worked out?" rows) is read
// from what `getSafeToSpendBreakdown` (src/modules/dashboard/) returned,
// which is `getSafeToSpend`'s result plus a `period` block (see
// docs/SAFE-TO-SPEND.md §11b/§13). The "−"/"+" prefixes in the breakdown
// are labels, not arithmetic done here.

import { el } from '../dom.js';
import { iconChip } from './icons.js';
import { formatCents } from '../../core/money.js';
import { SAFE_TO_SPEND_LABEL, PLANNING_DISCLAIMER, getSafeToSpendMessage, getSafeToSpendSubtext } from '../../modules/safe-to-spend/index.js';

const row = (label, text, extraClass = '') =>
  el('div', { class: `hero__breakdown-row${extraClass ? ' ' + extraClass : ''}` }, [
    el('span', {}, label),
    el('span', { class: 'hero__breakdown-amount' }, text),
  ]);

/**
 * The collapsed "How is this worked out?" disclosure. Shows the EXACT
 * figures behind the headline and nothing else — a plain-language intro,
 * then the rows. There is no second calculation: every number is read
 * straight off what `getSafeToSpendBreakdown` returned:
 *
 *   In checking                          (period.inCheckingCents)
 *   + Arrived after that balance         (period.arrivedAfterBalanceCents)
 *   − Bills still to land                (result.upcomingBillsCents)
 *   − Paid and spent after that balance  (period.paidAndSpentAfterBalanceCents)
 *   − Already set aside                  (period.setAsideCents)
 *   ─────────────────────────────────
 *   Safe until payday                    (result.safeToSpendCents)
 *
 * By construction the rows reconcile to `netAfterCommittedCents` (then
 * floored to $0 → `safeToSpendCents`, §10) — see getSafeToSpendBreakdown's
 * doc in src/modules/dashboard/index.js. The "+"/"−" are labels, not
 * arithmetic done here (CLAUDE.md — money math stays in
 * src/modules/safe-to-spend/ + the dashboard composer).
 *
 * Over-committed (`isNegative`): the true negative total is shown as
 * "After everything" before the floored $0 headline.
 */
function renderBreakdown(result) {
  const p = result.period;
  const rows = [
    row('In checking', formatCents(p.inCheckingCents)),
    row('Arrived after that balance', `+ ${formatCents(p.arrivedAfterBalanceCents)}`),
    row('Bills still to land', `− ${formatCents(result.upcomingBillsCents)}`),
    row('Paid and spent after that balance', `− ${formatCents(p.paidAndSpentAfterBalanceCents)}`),
    row('Already set aside', `− ${formatCents(p.setAsideCents)}`),
  ];

  if (result.isNegative) {
    rows.push(row('After everything', formatCents(result.netAfterCommittedCents)));
    rows.push(row('Safe until payday (never below $0)', formatCents(result.safeToSpendCents), 'hero__breakdown-row--total'));
  } else {
    rows.push(row('Safe until payday', formatCents(result.safeToSpendCents), 'hero__breakdown-row--total'));
  }

  return el('details', { class: 'hero__breakdown' }, [
    el('summary', { class: 'hero__breakdown-summary' }, 'How is this worked out?'),
    el(
      'p',
      { class: 'hero__breakdown-intro' },
      "Your Safe to Spend is the money left after setting aside everything you've already spent, committed, or chosen to reserve.",
    ),
    el('div', { class: 'hero__breakdown-rows' }, rows),
  ]);
}

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
 * @param {ReturnType<typeof import('../../modules/dashboard/index.js').getSafeToSpendBreakdown>} result
 *   `getSafeToSpend`'s result plus a `period` block. Pure display — the
 *   "+ Add expense" action lives at the top of the dashboard (its
 *   view-header `titleAction`), not on this card.
 */
export function renderSafeToSpendHero(result) {
  // An ordinary positive result has no explanatory paragraph — null here
  // (the `el` children array drops nulls). getSafeToSpendMessage still
  // returns copy for the negative / exact-zero cases.
  const description = getSafeToSpendMessage(result);
  const amountClass = result.isNegative ? 'hero__amount hero__amount--negative' : 'hero__amount';
  const heroToneColor = result.isNegative ? 'var(--color-status-attention-text)' : 'var(--color-status-positive-text)';

  return el('section', { class: 'card hero', 'aria-labelledby': 'safe-to-spend-heading' }, [
    el('div', { class: 'hero__icon' }, [iconChip('trending-up', { color: heroToneColor })]),
    el('h2', { class: 'hero__label', id: 'safe-to-spend-heading' }, SAFE_TO_SPEND_LABEL),
    el('p', { class: amountClass }, formatCents(result.safeToSpendCents)),
    el('p', { class: 'hero__subtext' }, getSafeToSpendSubtext(result)),
    description ? el('p', { class: 'hero__description' }, description) : null,
    renderCommittedProgress(result),
    renderBreakdown(result),
    el('p', { class: 'hero__disclaimer' }, PLANNING_DISCLAIMER),
  ]);
}
