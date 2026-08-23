// The period card — Money in / Money out for whatever period is selected
// in the header bar's global period selector, titled with that period's
// own label (e.g. "This month", "This week" — period-selector.js's
// `getPeriodLabel`, threaded down from dashboard.js) instead of a static
// heading. Both figures come from src/modules/dashboard/index.js
// `getPeriodSummary`, unchanged.
//
// History worth knowing, since the file/function names below ("right
// now") no longer describe what's here, same as the CSS classes they
// render with (`.right-now*`, still named after this same lineage — see
// components.css's own comment on that): this used to be two separate
// cards ("This Period" + "Current Balance"), merged into one "Right Now"
// card (Current balance + Money in + Money out, three rows) at the
// user's request to fix inconsistent card grouping. The heading was then
// changed from the static "Right now" to the selected period's label.
// Finally, Current Balance was split back out into its own standalone
// card (src/ui/screens/dashboard.js, reusing the unmodified
// single-value-section.js component it always used before the merge) —
// at that point this card no longer contains anything that isn't
// period-scoped, so "right now" stopped fitting, but the file wasn't
// renamed for it (same call already made for the CSS classes: not worth
// the churn for an internal identifier with no user-visible effect). See
// CLAUDE.md "Current status" for the full account.
// This card still deliberately does NOT show a "Bills due" row (the old
// "This Period" card's third row) — that would duplicate the Bills Due
// Soon card sitting directly below it, and the summary strip above the
// hero already surfaces a bills-due count too.

import { el } from '../dom.js';
import { iconChip, sectionHeading } from './icons.js';
import { formatCents } from '../../core/money.js';

function row(iconName, label, valueText, color) {
  return el('div', { class: 'right-now__row' }, [
    iconChip(iconName, { color, small: true }),
    el('div', { class: 'right-now__text' }, [el('span', { class: 'right-now__label' }, label), el('span', { class: 'right-now__value' }, valueText)]),
  ]);
}

/**
 * @param {object} options
 * @param {ReturnType<typeof import('../../modules/dashboard/index.js').getPeriodSummary>} options.periodSummary
 * @param {string} options.periodLabel the header bar's selected period,
 *   already formatted (period-selector.js's `getPeriodLabel`) — this
 *   card's heading.
 */
export function renderRightNowSection({ periodSummary, periodLabel }) {
  const moneyInRow = row('trending-up', 'Money in', formatCents(periodSummary.moneyInCents), 'var(--color-status-positive-text)');
  const moneyOutRow = row('receipt', 'Money out', formatCents(periodSummary.moneyOutCents), 'var(--color-accent)');

  return el('section', { class: 'card card--quiet', 'aria-labelledby': 'right-now-heading' }, [
    sectionHeading('calendar', periodLabel, 'right-now-heading'),
    el('div', { class: 'right-now' }, [moneyInRow, moneyOutRow]),
  ]);
}
