// The app's brand lockup — an accent-filled badge with the `brand` glyph,
// next to a two-line wordmark ("Budget" over "and Planner"). Shared by
// the header bar (src/ui/components/header-bar.js) and the sidebar
// (src/ui/components/sidebar.js) so the mark is defined once. The
// two-line stack is deliberate, not an accidental wrap: it reads as a
// designed logotype and fits the 240px sidebar rail without clipping.
// When the sidebar is collapsed the CSS hides `.brand__name`, leaving
// just the badge.

import { el } from '../dom.js';
import { icon } from './icons.js';

/** @returns {HTMLElement} */
export function renderBrandMark() {
  return el('div', { class: 'brand', 'aria-label': 'Budget and Planner' }, [
    el('span', { class: 'brand__mark', 'aria-hidden': 'true' }, icon('brand', { size: 20 })),
    el('span', { class: 'brand__name' }, [
      el('span', { class: 'brand__name-primary' }, 'Budget'),
      el('span', { class: 'brand__name-sub' }, 'and Planner'),
    ]),
  ]);
}
