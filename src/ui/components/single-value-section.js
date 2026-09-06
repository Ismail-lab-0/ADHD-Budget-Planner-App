import { el } from '../dom.js';
import { amountField } from './amount-field.js';
import { sectionHeading, iconButton } from './icons.js';
import { renderPopup } from './popup.js';
import { parseAmountToCents, parseBalanceToCents, formatCents, centsToDollarString } from '../../core/money.js';

// Which section's "edit" popup (additive mode's `onEditTotal`, or
// `editOnly` mode — see below) is open, if any — transient UI state,
// deliberately outside the store (see docs/ARCHITECTURE.md §4). Holds the
// open section's `id`, not a plain boolean: this component now has two
// simultaneous callers that can each show this popup (Savings,
// Current Balance), and a single shared boolean would let one card's
// popup incorrectly "leak" open on the other the moment both had ever
// been opened in the same session — id-scoping keeps each instance's
// popup independent, same as e.g. inbox-section.js's `convertingDraftId`
// tracking which specific draft is mid-conversion rather than a bare flag.
let editPopupOpenId = null;

/**
 * A small popup form that sets a single money value directly — originally
 * just Savings' "edit total" pencil icon's popup, generalized (still
 * backward-compatible in every default) so `renderSingleValueSection`'s
 * own `editOnly` mode below can reuse the exact same popup-form pattern
 * for Current Balance's pencil instead of duplicating this boilerplate —
 * same reuse precedent as `renderExpenseForm` being shared across
 * multiple callers (docs/ARCHITECTURE.md §7 doesn't restrict this; only
 * reaching into another module's *data* internals is off-limits, not a
 * plain shared UI helper).
 * @param {object} options
 * @param {string} options.title
 * @param {number} options.valueCents
 * @param {(input: string) => number|null} [options.parse] defaults to
 *   non-negative parsing (Savings); pass `parseBalanceToCents` for a value
 *   that can legitimately go negative (Current Balance).
 * @param {string} [options.errorText]
 * @param {string|null} [options.hint] shown under the field if given;
 *   omit (or pass `null`) for none.
 * @param {string} [options.submitLabel] button text — defaults to "Save".
 * @param {boolean} [options.startEmpty] when true the field starts blank
 *   instead of prefilled with `valueCents` — for an "add this amount"
 *   contribution rather than a "correct the total" edit.
 * @param {(cents: number) => void} options.onSave
 */
export function renderEditTotalForm({
  title,
  valueCents,
  parse = parseAmountToCents,
  errorText = 'Enter an amount of 0 or more, like 150.00.',
  hint = 'This replaces the total directly — for fixing a mistake or reconciling against a real account, not a regular contribution.',
  submitLabel = 'Save',
  startEmpty = false,
  onSave,
}) {
  const input = el('input', {
    type: 'text',
    inputmode: 'decimal',
    class: 'field__input',
    value: startEmpty ? '' : centsToDollarString(valueCents),
    'aria-label': title,
  });
  const label = el('label', { class: 'field' }, [el('span', { class: 'field__label' }, title), input]);
  const error = el('p', { class: 'field__error', role: 'alert' });

  const form = el('form', { class: 'money-form' }, [
    label,
    error,
    hint ? el('p', { class: 'field__hint' }, hint) : null,
    el('div', { class: 'money-form__buttons' }, [el('button', { type: 'submit', class: 'btn btn--primary btn--small' }, submitLabel)]),
  ].filter(Boolean));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const cents = parse(input.value);
    if (cents == null) {
      error.textContent = errorText;
      return;
    }
    error.textContent = '';
    onSave(cents);
  });

  return form;
}

/**
 * A card section for a single money figure — Savings (Phase 2 §5) and
 * Current Balance (src/ui/screens/dashboard.js) are the current callers.
 * Current Balance's own history is longer than that sentence suggests: it
 * briefly lived as a hero subtitle, then got its own standalone card
 * (this component), then was folded into the merged "Right now" card
 * (src/ui/components/right-now-section.js) alongside Money in/out, then
 * was split back out into its own standalone card again — this
 * component, unchanged — at the user's later request. See CLAUDE.md
 * "Current status" for the full account. Kept general-purpose, not
 * hardcoded to either caller, precisely because its shape keeps getting
 * reused as the layout evolves.
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
 * @param {boolean} [options.editOnly] when true, skips the inline
 *   field/button form entirely — the card shows only "Currently: $X"
 *   plus a pencil icon that opens a popup (`renderEditTotalForm`) to
 *   change it, the same "no field or Save button visible until you ask
 *   for it" affordance `onEditTotal` gives Savings, but as the *only* way
 *   to edit rather than a secondary one alongside an "add" form. Current
 *   Balance uses this — it was never additive, so there's no separate add
 *   form for a pencil to be an alternative *to*; at the user's request the
 *   inline form was removed outright rather than kept as a redundant
 *   second way to do the same thing. Mutually exclusive with `additive`/
 *   `onEditTotal` in practice (nothing currently combines them, and
 *   `editOnly` takes precedence if it somehow happened).
 * @returns {HTMLElement}
 */
export function renderSingleValueSection({ id, title, description, valueCents, onSave, allowNegative = false, icon = 'wallet', additive = false, onEditTotal, editOnly = false, readOnly = false, requestRender }) {
  // `readOnly` (Dashboard summary): the value with no way to change it
  // here — editing lives on the Budget view. Short-circuits everything
  // below.
  if (readOnly) {
    const head = [sectionHeading(icon, title, id)];
    if (description) head.push(el('p', { class: 'section-description' }, description));
    head.push(el('p', { class: 'single-value-form__current' }, `${additive ? 'Currently saved' : 'Currently'}: ${formatCents(valueCents)}`));
    return el('section', { class: 'card card--quiet', 'aria-labelledby': id }, head);
  }

  const parse = allowNegative ? parseBalanceToCents : parseAmountToCents;
  const errorText = allowNegative ? 'Enter a valid amount, like 150.00 or -40.00.' : 'Enter an amount of 0 or more, like 150.00.';

  const currentLine = [el('span', {}, `${additive ? 'Currently saved' : 'Currently'}: ${formatCents(valueCents)}`)];

  const showPencil = editOnly || (additive && onEditTotal);
  let popup = null;
  if (showPencil) {
    const pencilLabel = editOnly ? `Edit ${title.toLowerCase()}` : `Edit ${title.toLowerCase()} total directly`;
    const popupTitle = editOnly ? `Edit ${title.toLowerCase()}` : `Edit ${title.toLowerCase()} total`;
    const saveHandler = editOnly ? onSave : onEditTotal;

    const closeEditPopup = () => {
      editPopupOpenId = null;
      requestRender?.();
    };
    currentLine.push(
      iconButton(
        'edit',
        pencilLabel,
        () => {
          editPopupOpenId = id;
          requestRender?.();
        },
        { tone: 'neutral' }
      )
    );
    if (editPopupOpenId === id) {
      const editForm = renderEditTotalForm({
        title: editOnly ? title : `${title} total`,
        valueCents,
        parse,
        errorText,
        hint: editOnly ? null : undefined, // undefined keeps renderEditTotalForm's own default (additive/Savings) hint text
        onSave: (cents) => {
          saveHandler(cents);
          closeEditPopup();
        },
      });
      popup = renderPopup({ titleId: `${id}-edit-total-heading`, title: popupTitle, body: editForm, onClose: closeEditPopup });
    }
  }

  let form;
  if (editOnly) {
    // No inline field/button at all — the popup above is the only way to
    // change this value (see `editOnly`'s doc comment).
    form = el('p', { class: 'single-value-form__current' }, currentLine);
  } else {
    const field = amountField(additive ? 'Amount to add' : title, { name: id, valueCents: additive ? null : valueCents });
    const error = el('p', { class: 'field__error', role: 'alert' });
    const success = el('p', { class: 'field__success', role: 'status' });

    form = el('form', { class: 'single-value-form' }, [
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
      // store updates (see src/ui/shell.js) — this just confirms the
      // click itself registered, since that re-render replaces this exact
      // element.
      success.textContent = additive ? `Added ${formatCents(cents)}.` : 'Saved.';
    });
  }

  const headChildren = [sectionHeading(icon, title, id)];
  if (description) headChildren.push(el('p', { class: 'section-description' }, description));

  // `.card--quiet` — a side-column "at a glance" figure, not primary
  // content, so it gets the same reduced-visual-weight treatment as its
  // side-column neighbors (the period card, Upcoming Income, Bills Due
  // Soon) instead of the full-weight `.card` styling Categories/Expenses
  // use — see the `.card--quiet` comment in components.css.
  return el('section', { class: 'card card--quiet', 'aria-labelledby': id }, [...headChildren, form, popup].filter(Boolean));
}
