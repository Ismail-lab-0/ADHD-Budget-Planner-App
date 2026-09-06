// A headline stat card — icon + label, a big value, and an optional
// "±X% ↑ from last month" delta chip or a plain supporting `note` line.
// Used on the Dashboard for Total Expenses / Total Savings / Total debt
// (beside the Safe-to-Spend hero), and — with a `note` — as the Debts
// view's "Still owed" summary card.

import { el } from '../dom.js';
import { iconChip } from './icons.js';

/**
 * @param {object} options
 * @param {string} options.icon
 * @param {string} options.label
 * @param {string} options.value already formatted (e.g. formatCents)
 * @param {string} [options.iconColor] overrides the tone-derived icon colour
 * @param {{pct: number, isGood: boolean}|null} [options.delta] — `pct`
 *   signed; `isGood` says whether that direction is a good thing (a drop
 *   in spending is good; a rise in savings is good).
 * @param {string} [options.note] a plain supporting line under the value
 *   (e.g. "Across 3 debts", or an empty-state hint). Ignored when
 *   `delta` is given.
 * @param {'neutral'|'positive'|'caution'|'attention'} [options.tone]
 *   tints the whole card (a `--color-status-*-bg` background + matching
 *   icon colour) instead of the default white surface — used for the
 *   per-tab summary cards on the Income / Expenses / Bills / Debts
 *   views. Default 'neutral' (the Dashboard's stat cards).
 */
export function renderStatCard({ icon, label, value, iconColor = null, delta = null, note = null, tone = 'neutral' }) {
  const resolvedIconColor = iconColor || (tone === 'neutral' ? 'var(--color-accent)' : `var(--color-status-${tone}-text)`);
  const children = [
    el('div', { class: 'stat-card__head' }, [iconChip(icon, { color: resolvedIconColor, small: true }), el('span', { class: 'stat-card__label' }, label)]),
    el('p', { class: 'stat-card__value' }, value),
  ];

  if (delta && Number.isFinite(delta.pct)) {
    const up = delta.pct >= 0;
    const chip = el('span', { class: `stat-card__delta stat-card__delta--${delta.isGood ? 'good' : 'bad'}` }, `${up ? '+' : ''}${delta.pct.toFixed(1)}% ${up ? '↑' : '↓'}`);
    children.push(el('p', { class: 'stat-card__delta-row' }, [chip, el('span', { class: 'stat-card__delta-note' }, 'from last month')]));
  } else if (note) {
    children.push(el('p', { class: 'stat-card__note' }, note));
  }

  const toneClass = tone === 'neutral' ? '' : ` stat-card--${tone}`;
  return el('section', { class: `card stat-card${toneClass}`, 'aria-label': label }, children);
}
