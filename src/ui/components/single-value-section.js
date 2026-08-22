import { el } from '../dom.js';
import { amountField } from './amount-field.js';
import { sectionHeading, iconButton } from './icons.js';
import { renderPopup } from './popup.js';
import { parseAmountToCents, parseBalanceToCents, formatCents, centsToDollarString } from '../../core/money.js';

// Whether the "edit total directly" popup (additive mode only — see
// `onEditTotal` below) is open — transient UI state, deliberately outside
// the store (see docs/ARCHITECTURE.md §4).
let editTotalFormOpen = false;

/** The small popup opened by the edit-total pencil icon (additive mode) — sets the total directly, unlike the card's own form which adds to it. */
function renderEditTotalForm({ title, valueCents, onSave }) {
  const input = el('input', {
    type: 'text',
    inputmode: 'decimal',
    class: 'field__input',
    value: centsToDollarString(valueCents),
    'aria-label': title,
  });
  const label = el('label', { class: 'field' }, [el('span', { class: 'field__label' }, title), input]);
  const error = el('p', { class: 'field__error', role: 'alert' });

  const form = el('form', { class: 'money-form' }, [
    label,
    error,
    el('p', { class: 'field__hint' }, 'This replaces the total directly — for fixing a mistake or reconciling against a real account, not a regular contribution.'),
    el('div', { class: 'money-form__buttons' }, [el('button', { type: 'submit', class: 'btn btn--primary btn--small' }, 'Save')]),
  ]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const cents = parseAmountToCents(input.value);
    if (cents == null) {
      error.textContent = 'Enter an amount of 0 or more, like 150.00.';
      return;
    }
    error.textContent = '';
    onSave(cents);
  });

  return form;
}

/**
 * A card section for a single money figure — Current Balance and Savings
 * (Phase 2 §1/§5). Current Balance briefly lived as a hero subtitle
 * during the dashboard redesign, then moved back to its own standalone
 * card at the user's request — see CLAUDE.md "Current status".
 * @param {object} options
 * @param {string} options.id used for the heading id and input name
 * @param {string} options.title
 * @param {string} [options.description]
 * @param {number} options.valueCents current stored value
 * @param {(cents: number) => void} options.onSave
 * @param {boolean} [options.allowNegative] for a value that can legitimately go negative
 * @param {string} [options.icon] icon name for the card's section heading
 *   (src/ui/components/icons.js) — defaults to a neutral wallet
 * @param {() => void} [options.requestRender] needed only alongside
 *   `onEditTotal`, to re-render after opening/closing that popup
 * @param {boolean} [options.additive] when true, the form adds `onSave`'s
 *   amount to the existing total instead of replacing it — the field
 *   starts blank ("how much to add," not "what's the new total"), and
 *   copy/button text reflect a contribution rather than a correction. See
 *   `addToSavingsAction` (src/modules/budget/index.js) — the Savings card
 *   uses this.
 * @param {(cents: number) => void} [options.onEditTotal] only meaningful
 *   alongside `additive` — when given, a small pencil icon next to
 *   "Currently saved: $X" opens a popup to set the total directly
 *   (`setSavingsAllocationAction`), for correcting a mistake or
 *   reconciling against a real account, since the card's own form can
 *   only add.
 * @returns {HTMLElement}
 */
export function renderSingleValueSection({ id, title, description, valueCents, onSave, allowNegative = false, icon = 'wallet', additive = false, onEditTotal, requestRender }) {
  const field = amountField(additive ? 'Amount to add' : title, { name: id, valueCents: additive ? null : valueCents });
  const error = el('p', { class: 'field__error', role: 'alert' });
  const success = el('p', { class: 'field__success', role: 'status' });
  const parse = allowNegative ? parseBalanceToCents : parseAmountToCents;
  const errorText = allowNegative ? 'Enter a valid amount, like 150.00 or -40.00.' : 'Enter an amount of 0 or more, like 150.00.';

  const currentLine = [el('span', {}, `${additive ? 'Currently saved' : 'Currently'}: ${formatCents(valueCents)}`)];

  let popup = null;
  if (additive && onEditTotal) {
    const closeEditTotal = () => {
      editTotalFormOpen = false;
      requestRender?.();
    };
    currentLine.push(
      iconButton(
        'edit',
        `Edit ${title.toLowerCase()} total directly`,
        () => {
          editTotalFormOpen = true;
          requestRender?.();
        },
        { tone: 'neutral' }
      )
    );
    if (editTotalFormOpen) {
      const editForm = renderEditTotalForm({
        title: `${title} total`,
        valueCents,
        onSave: (cents) => {
          onEditTotal(cents);
          closeEditTotal();
        },
      });
      popup = renderPopup({ titleId: `${id}-edit-total-heading`, title: `Edit ${title.toLowerCase()} total`, body: editForm, onClose: closeEditTotal });
    }
  }

  const form = el('form', { class: 'single-value-form' }, [
    el('p', { class: 'single-value-form__current' }, currentLine),
    field,
    error,
    success,
    el('button', { type: 'submit', class: 'btn btn--primary btn--small' }, additive ? '+ Add' : 'Save'),
  ]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const cents = parse(field.amountInput.value);
    if (cents == null) {
      error.textContent = errorText;
      return;
    }
    error.textContent = '';
    onSave(cents);
    // The card re-renders with the new "Currently: $X" the moment the
    // store updates (see src/ui/shell.js) — this just confirms the click
    // itself registered, since that re-render replaces this exact element.
    success.textContent = additive ? `Added ${formatCents(cents)}.` : 'Saved.';
  });

  const headChildren = [sectionHeading(icon, title, id)];
  if (description) headChildren.push(el('p', { class: 'section-description' }, description));

  return el('section', { class: 'card', 'aria-labelledby': id }, [...headChildren, form, popup].filter(Boolean));
}
