// A small, hand-authored inline SVG icon set — no CDN, no icon-font
// package (see CLAUDE.md: "nothing in this app should make a network
// request in normal use," and the app must stay buildable into one
// self-contained HTML file). Every icon is a plain 24x24 stroke glyph,
// styled in the same minimal, geometric spirit as a Lucide-style icon set,
// authored directly as inline markup so the whole set costs nothing at
// runtime and nothing at build time.
//
// Icons are always paired with a visible text label wherever they appear
// (button text, a card's `<h2>`, a list row's title) — never the only way
// to identify something (docs/TEST-PLAN.md accessibility checklist), so
// every icon here is `aria-hidden`.

const ICON_PATHS = {
  wallet:
    '<path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2"/><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M16 13h3a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-3a2 2 0 0 1 0-4Z"/>',
  receipt: '<path d="M5 3h14v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5V3Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  'file-text': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
  'trending-up': '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  'pie-chart': '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l7-3.5"/>',
  list: '<circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/><path d="M9 6h11M9 12h11M9 18h11"/>',
  zap: '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/>',
  shield: '<path d="M12 3 5 6v6c0 5 3.5 8 7 9 3.5-1 7-4 7-9V6Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  basket: '<path d="M4 9h16l-1.5 10.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5Z"/><path d="M8 9 10 4M16 9 14 4M9 13v4M15 13v4"/>',
  utensils: '<path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11"/><path d="M17 3c-1.5 0-3 1.5-3 4s1.5 4 3 4v10"/>',
  car: '<path d="M3 17V12L5 7H19L21 12V17"/><path d="M3 17h18"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  'shopping-bag': '<path d="M6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5 16 12l-6 3.5Z"/>',
  heart: '<path d="M12 20s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 5c-2.5 4.5-9.5 9-9.5 9Z"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  tag: '<path d="M2 12 12 2h7a2 2 0 0 1 2 2v7l-10 10a2 2 0 0 1-3 0l-6-6a2 2 0 0 1 0-3Z"/><circle cx="16" cy="8" r="1" fill="currentColor" stroke="none"/>',
  'alert-triangle': '<path d="M12 3 2 20h20Z"/><path d="M12 9v5"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="M15 5l4 4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  close: '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.8 6.8 0 0 0 20 14.5Z"/>',
};

function svgMarkup(name, size) {
  const body = ICON_PATHS[name] ?? ICON_PATHS.tag;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

/**
 * A bare inline icon (e.g. inside a button, next to text on the same
 * line). Always `aria-hidden` — never the only identifier for what it's
 * next to.
 * @param {keyof typeof ICON_PATHS} name
 * @param {{size?: number}} [options]
 */
export function icon(name, { size = 16 } = {}) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = svgMarkup(name, size);
  return span;
}

/**
 * An icon inside a small tinted rounded chip — used for section-header
 * badges and leading icons on list rows. `color` is a CSS color value
 * (usually a `var(--color-...)` token); the chip's background is a soft
 * tint of that same color via `color-mix`, so adding a new tint never
 * requires a second token.
 * @param {keyof typeof ICON_PATHS} name
 * @param {{color?: string, small?: boolean}} [options]
 */
export function iconChip(name, { color = 'var(--color-accent)', small = false } = {}) {
  const span = document.createElement('span');
  span.className = small ? 'icon-chip icon-chip--sm' : 'icon-chip';
  span.style.setProperty('--chip-color', color);
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = svgMarkup(name, small ? 15 : 18);
  return span;
}

/**
 * A small, square icon-only button (e.g. a row's Edit/Delete actions).
 * Unlike `icon()`, this is a real, focusable `<button>` — icon-only
 * controls must carry their own accessible name since there's no visible
 * text label next to them (docs/TEST-PLAN.md accessibility checklist),
 * so `label` is required, not optional, and becomes `aria-label`.
 * @param {keyof typeof ICON_PATHS} name
 * @param {string} label accessible name, e.g. "Edit Groceries"
 * @param {() => void} onClick
 * @param {{tone?: 'neutral'|'attention'}} [options]
 */
export function iconButton(name, label, onClick, { tone = 'neutral' } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `icon-btn${tone === 'attention' ? ' icon-btn--attention' : ''}`;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = svgMarkup(name, 16);
  button.addEventListener('click', onClick);
  return button;
}

/**
 * A standard card header: a small icon chip beside an `<h2>`. Used in
 * place of a bare `el('h2', {id}, text)` everywhere a card wants the
 * section-header icon treatment.
 * @param {keyof typeof ICON_PATHS} name
 * @param {string} text
 * @param {string} [id] heading id, for `aria-labelledby` on the parent card
 * @param {{color?: string}} [options]
 */
export function sectionHeading(name, text, id, { color } = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'section-heading';
  wrapper.appendChild(iconChip(name, { color, small: true }));
  const heading = document.createElement('h2');
  if (id) heading.id = id;
  heading.textContent = text;
  wrapper.appendChild(heading);
  return wrapper;
}

// Expense categories are free text, not a locked enum (docs/DATA-MODEL.md)
// — `DEFAULT_EXPENSE_CATEGORIES` (src/modules/expenses/selectors.js) are
// just suggestions. These two maps cover that default set; anything else
// (a custom category the user typed) falls back to a neutral tag icon
// rather than guessing.
export const CATEGORY_ICON = {
  Groceries: 'basket',
  'Eating Out': 'utensils',
  Transport: 'car',
  Shopping: 'shopping-bag',
  Entertainment: 'play',
  Health: 'heart',
  Subscriptions: 'repeat',
  Other: 'tag',
};

export const CATEGORY_COLOR = {
  Groceries: 'var(--color-cat-groceries)',
  'Eating Out': 'var(--color-cat-eating-out)',
  Transport: 'var(--color-cat-transport)',
  Shopping: 'var(--color-cat-shopping)',
  Entertainment: 'var(--color-cat-entertainment)',
  Health: 'var(--color-cat-health)',
  Subscriptions: 'var(--color-cat-subscriptions)',
  Other: 'var(--color-text-secondary)',
};

/**
 * The icon chip for one expense/budget category, falling back to a
 * neutral tag for anything outside the default suggestion list.
 * @param {string|null|undefined} category
 * @param {{small?: boolean}} [options]
 */
export function categoryIconChip(category, { small = false } = {}) {
  const name = CATEGORY_ICON[category] ?? 'tag';
  const color = CATEGORY_COLOR[category] ?? CATEGORY_COLOR.Other;
  return iconChip(name, { color, small });
}

/** @param {string|null|undefined} category @returns {string} a CSS color value */
export function categoryColor(category) {
  return CATEGORY_COLOR[category] ?? CATEGORY_COLOR.Other;
}

// A friendlier, more playful category badge — a real emoji (no image/font
// request, just Unicode text) instead of a stroke icon. Kept as a second,
// deliberate option alongside `categoryIconChip` rather than replacing it
// everywhere, since the stroke-icon style still fits section headers and
// other list types. Not currently used by any screen (the Budget Planning
// section that used it was removed at the user's request), but left
// available here as a still-working, reusable primitive.
export const CATEGORY_EMOJI = {
  Groceries: '🛒',
  'Eating Out': '🍽️',
  Transport: '🚗',
  Shopping: '🛍️',
  Entertainment: '🎉',
  Health: '❤️',
  Subscriptions: '💳',
  Other: '✨',
};

/**
 * A larger rounded-square emoji badge for one category, same color
 * identity as `categoryIconChip` (a soft tint of the category's color).
 * @param {string|null|undefined} category
 */
export function categoryEmojiBadge(category) {
  const emoji = CATEGORY_EMOJI[category] ?? '🏷️';
  const color = CATEGORY_COLOR[category] ?? CATEGORY_COLOR.Other;
  const span = document.createElement('span');
  span.className = 'emoji-badge';
  span.style.setProperty('--chip-color', color);
  span.setAttribute('aria-hidden', 'true');
  span.textContent = emoji;
  return span;
}
