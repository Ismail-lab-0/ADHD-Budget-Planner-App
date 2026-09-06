// The dashboard's "Overview" chart — grouped columns comparing money in
// vs money out per month. Hand-authored SVG built as a string (the same
// technique as src/ui/components/icons.js — no chart library, nothing
// added to the zero-dependency / self-contained build). Interactivity is
// a native `<title>` per mark.
//
// Follows the data-viz method: two categorical series with an
// always-present legend (identity is never colour-alone), thin marks
// (<= 20px) with air left in each band, a 2px surface-colour gap between
// touching sub-bars, 4px rounded tops on a square baseline, three
// recessive hairline gridlines, text in text tokens (never the mark
// colour), a calm empty state.

import { el } from '../dom.js';
import { emptyState } from './empty-state.js';
import { sectionHeading } from './icons.js';
import { formatCents, getActiveCurrency, getCurrencySymbol } from '../../core/money.js';

const GRID = 'var(--color-border)';
const MUTED = 'var(--color-text-secondary)';

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** A short money string for axis ticks: "$0", "$340", "$1.2k", "$18k", "$2.4M". */
function compactMoney(cents) {
  const sym = getCurrencySymbol(getActiveCurrency());
  const n = Math.round((Number.isFinite(cents) ? cents : 0) / 100);
  const abs = Math.abs(n);
  if (abs >= 1000000) return sym + (n / 1000000).toFixed(abs % 1000000 >= 100000 ? 1 : 0) + 'M';
  if (abs >= 1000) return sym + (n / 1000).toFixed(abs % 1000 >= 100 ? 1 : 0) + 'k';
  return sym + n;
}

/** Round `v` up to a clean axis maximum (1/2/5 × 10ⁿ). */
function niceMax(v) {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function roundedTopBar(x, y, w, h, baseY) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return (
    `M${x.toFixed(1)},${baseY} L${x.toFixed(1)},${(y + r).toFixed(1)} ` +
    `Q${x.toFixed(1)},${y.toFixed(1)} ${(x + r).toFixed(1)},${y.toFixed(1)} ` +
    `L${(x + w - r).toFixed(1)},${y.toFixed(1)} ` +
    `Q${(x + w).toFixed(1)},${y.toFixed(1)} ${(x + w).toFixed(1)},${(y + r).toFixed(1)} ` +
    `L${(x + w).toFixed(1)},${baseY} Z`
  );
}

/**
 * @param {object} options
 * @param {string} options.title
 * @param {string} [options.subtitle]
 * @param {Array<{label: string, values: number[]}>} options.bars — one
 *   `values` entry per series, in cents; kept in order (zero-value
 *   months included so a quiet stretch reads as a gap).
 * @param {Array<{label: string, color: string}>} options.series — 1 or 2.
 * @param {string} [options.emptyMessage]
 */
export function renderColumnChart({ title, subtitle, bars, series, emptyMessage = 'Nothing to chart for this period yet.' }) {
  const head = [sectionHeading('trending-up', title, undefined)];
  if (subtitle) head.push(el('p', { class: 'section-description' }, subtitle));

  const flat = bars.flatMap((b) => b.values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0)));
  const total = flat.reduce((a, b) => a + b, 0);
  if (bars.length === 0 || total === 0) {
    return el('section', { class: 'card viz-card', 'aria-label': title }, [...head, emptyState(emptyMessage)]);
  }

  const W = 560;
  const H = 280;
  const padL = 52;
  const padR = 14;
  const padT = 18;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const baseY = padT + plotH;
  const top = niceMax(Math.max(...flat));

  const n = bars.length;
  const band = plotW / n;
  const groupW = band * 0.66;
  const gap = series.length > 1 ? 3 : 0;
  const subW = Math.min(22, (groupW - gap * (series.length - 1)) / series.length);

  const parts = [`<svg class="viz__svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}" preserveAspectRatio="xMidYMid meet">`];

  for (const t of [0, 0.5, 1]) {
    const y = baseY - t * plotH;
    parts.push(`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="${GRID}" stroke-width="1"/>`);
    parts.push(`<text x="${padL - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" font-size="11" fill="${MUTED}">${esc(compactMoney(top * t))}</text>`);
  }

  bars.forEach((b, i) => {
    const groupX = padL + i * band + (band - subW * series.length - gap * (series.length - 1)) / 2;
    series.forEach((s, j) => {
      const v = Number.isFinite(b.values[j]) && b.values[j] > 0 ? b.values[j] : 0;
      const h = (v / top) * plotH;
      const x = groupX + j * (subW + gap);
      const d = roundedTopBar(x, baseY - h, subW, h, baseY);
      parts.push(`<g><title>${esc(b.label)} — ${esc(s.label)}: ${esc(formatCents(v))}</title>`);
      if (d) parts.push(`<path d="${d}" fill="${s.color}"/>`);
      parts.push(`</g>`);
    });
    const showLabel = n <= 12;
    if (showLabel) {
      parts.push(`<text x="${(groupX + (subW * series.length + gap * (series.length - 1)) / 2).toFixed(1)}" y="${baseY + 16}" text-anchor="middle" font-size="10" fill="${MUTED}">${esc(b.label)}</text>`);
    }
  });

  parts.push('</svg>');

  const fig = el('figure', { class: 'viz' });
  fig.innerHTML = parts.join('');

  const children = [...head, fig];
  if (series.length > 1) {
    children.push(
      el(
        'ul',
        { class: 'viz-legend viz-legend--row' },
        series.map((s) =>
          el('li', { class: 'viz-legend__item' }, [
            el('span', { class: 'viz-legend__swatch', style: `background:${s.color}` }),
            el('span', { class: 'viz-legend__label' }, s.label),
          ])
        )
      )
    );
  }

  return el('section', { class: 'card viz-card', 'aria-label': title }, children);
}
