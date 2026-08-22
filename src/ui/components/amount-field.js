import { el } from '../dom.js';
import { centsToDollarString } from '../../core/money.js';

/**
 * A labeled money input. Free-text (not type="number") so users can type
 * "$1,200.00" naturally — parsing/validation happens on submit via
 * core/money.js's parseAmountToCents, not on every keystroke.
 * @param {string} labelText
 * @param {{name?: string, valueCents?: number|null}} [options]
 * @returns {HTMLLabelElement} with `.amountInput` set to the nested <input>
 */
export function amountField(labelText, { name, valueCents = null } = {}) {
  const input = el('input', {
    type: 'text',
    inputmode: 'decimal',
    name,
    class: 'field__input',
    value: valueCents != null ? centsToDollarString(valueCents) : '',
    placeholder: '0.00',
    'aria-label': labelText,
  });
  const label = el('label', { class: 'field' }, [el('span', { class: 'field__label' }, labelText), input]);
  label.amountInput = input;
  return label;
}
