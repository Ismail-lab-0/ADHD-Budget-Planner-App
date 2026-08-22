// The full Income list/edit/delete section was removed at the user's
// request. `renderIncomeForm` survives because it's still reused by the
// "Upcoming income" card's "+ Add income" (src/ui/components/
// upcoming-income.js) — this file is now just that form.

import { el } from '../dom.js';
import { amountField } from './amount-field.js';
import { renderMoreOptions } from './more-options.js';
import { icon } from './icons.js';
import { parseAmountToCents } from '../../core/money.js';
import { INCOME_FREQUENCIES } from '../../modules/incomes/index.js';

const FREQUENCY_LABEL = { 'one-time': 'One-time', weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly' };

function frequencyField(value) {
  const select = el(
    'select',
    { name: 'frequency', class: 'field__input' },
    INCOME_FREQUENCIES.map((freq) => el('option', { value: freq, selected: freq === value || undefined }, FREQUENCY_LABEL[freq]))
  );
  return el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'Frequency'), select]);
}

function incomeDateField(labelText, { name, value }) {
  const input = el('input', { type: 'date', name, value: value || '', class: 'field__input' });
  return el('label', { class: 'field' }, [el('span', { class: 'field__label' }, labelText), input]);
}

/**
 * Exported for reuse as a compact quick-add form (the dashboard's Quick
 * Actions). Name + Amount + Next date up front — the date matters too
 * much to Safe-to-Spend's payday horizon to bury it — with only Frequency
 * (which defaults sensibly to one-time) behind "+ More options" (Phase 7).
 * Editing starts expanded.
 */
export function renderIncomeForm({ income = null, onSubmit, onCancel }) {
  const isEdit = income != null;
  const nameInput = el('input', {
    type: 'text',
    name: 'name',
    class: 'field__input',
    placeholder: 'Income name, e.g. "Paycheck"',
    value: income?.name ?? '',
    'aria-label': 'Income name',
  });
  const amount = amountField('Amount', { name: 'amountCents', valueCents: income?.amountCents ?? null });
  const error = el('p', { class: 'field__error', role: 'alert' });

  const more = renderMoreOptions(() => [frequencyField(income?.frequency ?? 'one-time')], { startExpanded: isEdit });

  const form = el('form', { class: 'money-form' }, [
    nameInput,
    amount,
    incomeDateField('Next date', { name: 'nextDate', value: income?.nextDate }),
    more.toggle,
    more.details,
    error,
    el(
      'div',
      { class: 'money-form__buttons' },
      [
        el('button', { type: 'submit', class: 'btn btn--primary btn--small' }, isEdit ? 'Save' : [icon('trending-up'), 'Add income']),
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
    const payload = { name, amountCents, frequency: formData.get('frequency') };
    const nextDate = formData.get('nextDate');
    if (nextDate) payload.nextDate = nextDate; // omit when blank so an edit never clobbers it with nothing

    onSubmit(payload);
    if (!isEdit) {
      nameInput.value = '';
      amount.amountInput.value = '';
    }
  });

  return form;
}
