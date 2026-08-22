import { el } from '../dom.js';

/**
 * A single row in a money list (income/bill/planned-expense/expense) —
 * an optional leading icon chip, title, small meta pieces, and action
 * buttons.
 * @param {object} options
 * @param {string} options.title
 * @param {(string|HTMLElement|null)[]} [options.meta]
 * @param {HTMLElement[]} [options.actions]
 * @param {HTMLElement|null} [options.icon] a pre-built icon chip (see
 *   src/ui/components/icons.js `iconChip`/`categoryIconChip`) — this file
 *   stays agnostic about which icon/color a row gets, so it never needs
 *   to know about categories or list types itself.
 */
export function renderMoneyItem({ title, meta = [], actions = [], icon = null }) {
  const metaEls = meta.filter(Boolean).map((m) => (typeof m === 'string' ? el('span', { class: 'money-item__meta-text' }, m) : m));
  return el(
    'li',
    { class: 'money-item' },
    [
      icon,
      el('div', { class: 'money-item__body' }, [
        el('span', { class: 'money-item__title' }, title),
        el('div', { class: 'money-item__meta' }, metaEls),
      ]),
      el('div', { class: 'money-item__actions' }, actions),
    ].filter(Boolean)
  );
}
