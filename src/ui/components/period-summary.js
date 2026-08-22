// "This Period" — a compact glance at money in / money out / bills due,
// for whatever period is selected in the header bar's global period
// selector (src/ui/components/period-selector.js). Every figure comes
// from src/modules/dashboard/index.js `getPeriodSummary` — this file only
// formats and lays them out, it never computes a total itself. Never used
// by Safe-to-Spend or Current Balance, which are always "right now"
// snapshots regardless of the selected period.

import { el } from '../dom.js';
import { iconChip, sectionHeading } from './icons.js';
import { formatCents } from '../../core/money.js';

function periodRow(iconName, label, valueText, color) {
  return el('div', { class: 'period-summary__row' }, [
    iconChip(iconName, { color, small: true }),
    el('div', { class: 'period-summary__text' }, [
      el('span', { class: 'period-summary__label' }, label),
      el('span', { class: 'period-summary__value' }, valueText),
    ]),
  ]);
}

/**
 * @param {ReturnType<typeof import('../../modules/dashboard/index.js').getPeriodSummary>} summary
 *   "Money in" means a schedule projection for a bounded period (This
 *   week/month/etc.) but a real historical total (confirmed IncomeReceipts)
 *   for an unbounded one ("All time") — see getPeriodSummary's doc
 *   comment for the full reasoning. Same label either way; both are
 *   genuinely "money in," just derived differently depending on whether
 *   there's a concrete window to project across.
 */
export function renderPeriodSummary(summary) {
  return el('section', { class: 'card card--quiet', 'aria-labelledby': 'period-summary-heading' }, [
    sectionHeading('calendar', 'This period', 'period-summary-heading'),
    el('div', { class: 'period-summary' }, [
      periodRow('trending-up', 'Money in', formatCents(summary.moneyInCents), 'var(--color-status-positive-text)'),
      periodRow('receipt', 'Money out', formatCents(summary.moneyOutCents), 'var(--color-accent)'),
      periodRow('file-text', 'Bills due', String(summary.billsDueCount), summary.billsDueCount > 0 ? 'var(--color-status-caution-text)' : 'var(--color-text-secondary)'),
    ]),
  ]);
}
