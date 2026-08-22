// The full Upcoming Bills list/edit/delete section was removed at the
// user's request, then restored in a different shape: `renderBillForm`
// is reused by the "Bills due soon" card's "Manage bills" popup
// (src/ui/components/bills-due-soon.js — full add/edit/delete over every
// bill, not just the nearest few) and the onboarding flow's "Upcoming
// bills" step (src/ui/screens/onboarding.js) — this file is now just
// that form.

import { el } from '../dom.js';
import { amountField } from './amount-field.js';
import { renderMoreOptions } from './more-options.js';
import { icon } from './icons.js';
import { parseAmountToCents } from '../../core/money.js';
import { BILL_RECURRENCES } from '../../modules/bills/index.js';

const RECURRENCE_LABEL = { 'one-time': 'One-time', weekly: 'Weekly', monthly: 'Monthly' };

function recurrenceField(value) {
  const select = el(
    'select',
    { name: 'recurrence', class: 'field__input' },
    BILL_RECURRENCES.map((r) => el('option', { value: r, selected: r === value || undefined }, RECURRENCE_LABEL[r]))
  );
  return el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'Recurrence'), select]);
}

function billDateField(labelText, { name, value }) {
  const input = el('input', { type: 'date', name, value: value || '', class: 'field__input' });
  return el('label', { class: 'field' }, [el('span', { class: 'field__label' }, labelText), input]);
}

/**
 * Exported for reuse as a compact quick-add form (the dashboard's Quick
 * Actions, and the onboarding flow's "Upcoming bills" step). Name + Amount
 * up front; Due date/Recurrence behind "+ More options" (Phase 7 — fewer
 * decisions for the common case; sensible defaults apply automatically if
 * left collapsed). Editing starts expanded.
 */
export function renderBillForm({ bill = null, onSubmit, onCancel }) {
  const isEdit = bill != null;
  const nameInput = el('input', {
    type: 'text',
    name: 'name',
    class: 'field__input',
    placeholder: 'Bill name, e.g. "Rent"',
    value: bill?.name ?? '',
    'aria-label': 'Bill name',
  });
  const amount = amountField('Amount', { name: 'amountCents', valueCents: bill?.amountCents ?? null });
  const error = el('p', { class: 'field__error', role: 'alert' });

  const more = renderMoreOptions(
    () => [billDateField('Due date', { name: 'dueDate', value: bill?.dueDate }), recurrenceField(bill?.recurrence ?? 'one-time')],
    { startExpanded: isEdit }
  );

  const form = el('form', { class: 'money-form' }, [
    nameInput,
    amount,
    more.toggle,
    more.details,
    error,
    el(
      'div',
      { class: 'money-form__buttons' },
      [
        el('button', { type: 'submit', class: 'btn btn--primary btn--small' }, isEdit ? 'Save' : [icon('file-text'), 'Add bill']),
        isEdit ? el('button', { type: 'button', class: 'btn btn--secondary btn--small', onclick: () => onCancel() }, 'Cancel') : null,
      ].filter(Boolean)
    ),
  ]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const amountCents = parseAmountToCents(amount.amountInput.value);
    if (!name || amountCents == null) {
      error.textContent = 'Enter a name and a valid amount (0 or more).';
      return;
    }
    error.textContent = '';

    const formData = new FormData(form);
    const payload = { name, amountCents, recurrence: formData.get('recurrence') };
    const dueDate = formData.get('dueDate');
    if (dueDate) payload.dueDate = dueDate;

    onSubmit(payload);
    if (!isEdit) {
      nameInput.value = '';
      amount.amountInput.value = '';
    }
  });

  return form;
}
