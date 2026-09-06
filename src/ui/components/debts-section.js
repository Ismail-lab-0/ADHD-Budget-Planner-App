// The "Debt overview" card — a per-debt progress bar answering "how much
// do I owe, am I making progress?". Two modes:
//   - compact (Dashboard summary — currently unused): progress bars only
//     + a "View all debts →" link that routes to the Debts view. No
//     actions.
//   - full (the Debts view, src/ui/screens/debts-view.js): a tinted
//     "Still owed" summary card, then each debt as its own card with a
//     "Make payment" button (a popup that logs a real Expense —
//     src/modules/debts/payment-effect.js, so the money hits Current
//     Balance / Safe-to-Spend exactly once) plus a pencil to edit
//     (inline form) and a trash to delete — the same row shape as the
//     Income view.
//
// Tone stays calm and non-judgmental (docs/PRODUCT.md §10): "amount
// remaining", "paid off", "making progress" — never "you owe".

import { el } from '../dom.js';
import { emptyState } from './empty-state.js';
import { amountField } from './amount-field.js';
import { renderMoreOptions } from './more-options.js';
import { renderPopup } from './popup.js';
import { renderStatCard } from './stat-card.js';
import { sectionHeading, iconButton, icon } from './icons.js';
import { formatCents, parseAmountToCents } from '../../core/money.js';
import { getLocalDateKey, parseLocalDate } from '../../core/date.js';
import { getAllDebts, getDebtProgress, getTotalDebtCents, estimatePayoff, updateDebtAction, deleteDebtAction, recordDebtPaymentAction, DEBT_PAYMENT_FREQUENCIES } from '../../modules/debts/index.js';

// Transient UI state for the Debts view (see docs/ARCHITECTURE.md §4):
// which debt row is being edited inline, and which one's "Make payment"
// popup is open. Distinct names — the bundler concatenates every module
// into one scope (build/build.js).
let editingDebtId = null;
let payingDebtId = null;

const DEBT_FREQUENCY_LABEL = { monthly: 'Monthly', biweekly: 'Every 2 weeks', weekly: 'Weekly' };
const PAYOFF_MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

function payoffLine(debt, now) {
  const estimate = estimatePayoff(debt, { now });
  if (!estimate) return null;
  if (!estimate.coversInterest || !estimate.payoffDateKey) {
    return el('p', { class: 'debt-row__payoff' }, "Estimate: this payment doesn't cover the interest yet.");
  }
  const when = PAYOFF_MONTH_FMT.format(parseLocalDate(estimate.payoffDateKey));
  return el('p', { class: 'debt-row__payoff' }, `Estimated payoff: around ${when} (estimate)`);
}

function debtRow({ debt, now, dispatch, requestRender, compact }) {
  const progress = getDebtProgress(debt);
  const percent = Math.round(progress.percentPaid);

  const top = el('div', { class: 'debt-row__top' }, [
    el('span', { class: 'debt-row__name' }, debt.name),
    el('span', { class: 'debt-row__percent' }, progress.isPaidOff ? 'Paid off 🎉' : `${percent}% paid off`),
  ]);

  const balances = el(
    'div',
    { class: 'debt-row__balances' },
    `${formatCents(debt.currentBalanceCents)} remaining · ${formatCents(debt.originalBalanceCents)} original`
  );

  const bar = el('div', { class: 'debt-row__bar' }, [
    el('div', { class: 'debt-row__bar-fill', style: `width: ${progress.percentPaid}%` }),
  ]);

  const bodyChildren = [top, balances, bar];
  let iconActions = null;
  if (!compact) {
    const payoff = progress.isPaidOff ? null : payoffLine(debt, now);
    if (payoff) bodyChildren.push(payoff);

    if (!progress.isPaidOff) {
      bodyChildren.push(
        el('div', { class: 'debt-row__pay' }, [
          el(
            'button',
            {
              type: 'button',
              class: 'btn btn--secondary btn--small',
              onclick: () => {
                payingDebtId = debt.id;
                requestRender?.();
              },
            },
            'Make payment'
          ),
        ])
      );
    }

    // Edit + delete sit on the top line, right of the content — not
    // stacked under everything (matches the Categories / Goals cards).
    iconActions = el('div', { class: 'debt-row__actions' }, [
      iconButton('edit', `Edit ${debt.name}`, () => {
        editingDebtId = debt.id;
        requestRender?.();
      }),
      iconButton(
        'trash',
        `Delete ${debt.name}`,
        () => {
          if (window.confirm(`Delete "${debt.name}"? This removes the debt only — payments you've already logged stay in your expense history.`)) {
            dispatch(deleteDebtAction(debt.id));
          }
        },
        { tone: 'attention' }
      ),
    ]);
  }

  return el('li', { class: `debt-row${progress.isPaidOff ? ' debt-row--paid' : ''}` }, [
    el('div', { class: 'debt-row__body' }, bodyChildren),
    iconActions,
  ].filter(Boolean));
}

/* ---- Add / edit form ---- */

function dueDayField(value) {
  const input = el('input', {
    type: 'number',
    name: 'dueDate',
    min: '1',
    max: '31',
    class: 'field__input',
    value: value != null ? String(value) : '',
    placeholder: 'Day of month, e.g. 15',
    'aria-label': 'Payment due day',
  });
  const label = el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'Payment due day'), input]);
  label.dueDayInput = input;
  return label;
}

function aprField(value) {
  const input = el('input', {
    type: 'number',
    name: 'interestRate',
    min: '0',
    step: '0.01',
    class: 'field__input',
    value: value != null ? String(value) : '',
    placeholder: 'Optional — e.g. 19.99',
    'aria-label': 'Interest rate (APR)',
  });
  const label = el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'Interest rate (APR %)'), input]);
  label.aprInput = input;
  return label;
}

function debtFrequencyField(value) {
  const select = el(
    'select',
    { name: 'paymentFrequency', class: 'field__input' },
    DEBT_PAYMENT_FREQUENCIES.map((f) => el('option', { value: f, selected: f === value || undefined }, DEBT_FREQUENCY_LABEL[f]))
  );
  const label = el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'Payment frequency'), select]);
  label.selectInput = select;
  return label;
}

/**
 * The add/edit form for a debt. Required up front: name, original
 * balance, current balance, minimum payment, due day. APR (optional) and
 * payment frequency sit behind "+ More options". Editing starts expanded.
 * @param {object} options
 * @param {object|null} [options.debt]
 * @param {(input: object) => void} options.onSubmit
 * @param {() => void} [options.onCancel]
 */
export function renderDebtForm({ debt = null, onSubmit, onCancel }) {
  const isEdit = debt != null;

  const nameInput = el('input', {
    type: 'text',
    name: 'name',
    class: 'field__input',
    placeholder: 'Debt name, e.g. "Visa Card"',
    value: debt?.name ?? '',
    'aria-label': 'Debt name',
  });
  const original = amountField('Original balance', { name: 'originalBalanceCents', valueCents: debt?.originalBalanceCents ?? null });
  const current = amountField('Current balance', { name: 'currentBalanceCents', valueCents: debt?.currentBalanceCents ?? null });
  const minimum = amountField('Minimum payment', { name: 'minimumPaymentCents', valueCents: debt?.minimumPaymentCents ?? null });
  const dueDay = dueDayField(debt?.dueDate);
  const apr = aprField(debt?.interestRate);
  const freq = debtFrequencyField(debt?.paymentFrequency ?? 'monthly');
  const error = el('p', { class: 'field__error', role: 'alert' });

  const more = renderMoreOptions(() => [apr, freq], { startExpanded: isEdit });

  const form = el('form', { class: 'money-form' }, [
    nameInput,
    original,
    current,
    minimum,
    dueDay,
    more.toggle,
    more.details,
    error,
    el(
      'div',
      { class: 'money-form__buttons' },
      [
        el('button', { type: 'submit', class: 'btn btn--primary btn--small' }, isEdit ? 'Save' : [icon('wallet'), 'Add debt']),
        isEdit ? el('button', { type: 'button', class: 'btn btn--secondary btn--small', onclick: () => onCancel() }, 'Cancel') : null,
      ].filter(Boolean)
    ),
  ]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const originalBalanceCents = parseAmountToCents(original.amountInput.value);
    const currentBalanceCents = parseAmountToCents(current.amountInput.value);
    const minimumPaymentCents = parseAmountToCents(minimum.amountInput.value);
    const dueDate = Number.parseInt(dueDay.dueDayInput.value, 10);
    const aprRaw = apr.aprInput.value.trim();
    const interestRate = aprRaw === '' ? null : Number(aprRaw);

    if (!name || originalBalanceCents == null || currentBalanceCents == null || minimumPaymentCents == null) {
      error.textContent = 'Enter a name and valid amounts (0 or more) for the balances and minimum payment.';
      return;
    }
    if (!Number.isInteger(dueDate) || dueDate < 1 || dueDate > 31) {
      error.textContent = 'Enter a payment due day between 1 and 31.';
      return;
    }
    if (interestRate != null && (!Number.isFinite(interestRate) || interestRate < 0)) {
      error.textContent = 'Interest rate must be 0 or more, or left blank.';
      return;
    }
    error.textContent = '';

    onSubmit({
      name,
      originalBalanceCents,
      currentBalanceCents,
      minimumPaymentCents,
      dueDate,
      interestRate,
      // Read straight off the captured <select> (the same node is reused
      // across "+ More options" repaints), not FormData — the field isn't
      // in the DOM while "+ More options" is still collapsed.
      paymentFrequency: freq.selectInput.value,
    });

    if (!isEdit) {
      nameInput.value = '';
      original.amountInput.value = '';
      current.amountInput.value = '';
      minimum.amountInput.value = '';
      dueDay.dueDayInput.value = '';
      apr.aprInput.value = '';
    }
  });

  return form;
}

/* ---- Make a payment ---- */

function renderDebtPaymentForm({ debt, now, onSubmit }) {
  const amount = amountField('Payment amount', { name: 'amountCents', valueCents: debt.minimumPaymentCents ?? null });
  const dateInput = el('input', { type: 'date', name: 'date', class: 'field__input', value: getLocalDateKey(now), 'aria-label': 'Payment date' });
  const dateLabel = el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'Payment date'), dateInput]);
  const noteInput = el('input', { type: 'text', name: 'note', class: 'field__input', placeholder: 'Optional', 'aria-label': 'Note' });
  const noteLabel = el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'Note'), noteInput]);
  const error = el('p', { class: 'field__error', role: 'alert' });

  const form = el('form', { class: 'money-form' }, [
    el('p', { class: 'section-description' }, `${formatCents(debt.currentBalanceCents)} remaining on ${debt.name}.`),
    amount,
    dateLabel,
    noteLabel,
    error,
    el('div', { class: 'money-form__buttons' }, [el('button', { type: 'submit', class: 'btn btn--primary btn--small' }, 'Record payment')]),
  ]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const amountCents = parseAmountToCents(amount.amountInput.value);
    if (amountCents == null || amountCents === 0) {
      error.textContent = 'Enter a payment amount greater than 0.';
      return;
    }
    error.textContent = '';
    onSubmit({ amountCents, date: dateInput.value || getLocalDateKey(now), note: noteInput.value });
  });

  return form;
}

/**
 * @param {object} options
 * @param {object} options.state
 * @param {Function} options.dispatch
 * @param {Date} [options.now]
 * @param {() => void} [options.requestRender]
 * @param {boolean} [options.compact] Dashboard summary mode — progress
 *   bars only + "View all debts →". Default false (the Debts view).
 * @param {() => void} [options.onViewAll] target of the "View all debts →" link (compact only).
 */
export function renderDebtsSection({ state, dispatch, now = new Date(), requestRender, compact = false, onViewAll }) {
  const debts = getAllDebts(state);

  const body =
    debts.length === 0
      ? emptyState('No debts tracked yet — add your first debt to see where you stand and track your progress over time.')
      : el('ul', { class: 'debt-list' }, debts.map((debt) => debtRow({ debt, now, dispatch, requestRender, compact })));

  const headerAction =
    compact && onViewAll ? el('button', { type: 'button', class: 'link-button', onclick: onViewAll }, 'View all debts →') : null;

  const payingDebt = !compact && payingDebtId ? debts.find((d) => d.id === payingDebtId) : null;
  const closePayment = () => {
    payingDebtId = null;
    requestRender?.();
  };
  const paymentPopup = payingDebt
    ? renderPopup({
        titleId: 'debt-payment-heading',
        title: 'Make a payment',
        body: renderDebtPaymentForm({
          debt: payingDebt,
          now,
          onSubmit: (input) => {
            dispatch(recordDebtPaymentAction(payingDebt.id, input, { now }));
            closePayment();
          },
        }),
        onClose: closePayment,
      })
    : null;

  const editingDebt = !compact && editingDebtId ? debts.find((d) => d.id === editingDebtId) : null;
  const closeEdit = () => {
    editingDebtId = null;
    requestRender?.();
  };
  const editPopup = editingDebt
    ? renderPopup({
        titleId: 'edit-debt-heading',
        title: 'Edit debt',
        body: renderDebtForm({
          debt: editingDebt,
          onSubmit: (changes) => {
            dispatch(updateDebtAction(editingDebt.id, changes, { now }));
            closeEdit();
          },
          onCancel: closeEdit,
        }),
        onClose: closeEdit,
      })
    : null;

  if (compact) {
    return el('section', { class: 'card', 'aria-labelledby': 'debts-heading' }, [
      el('div', { class: 'card__header-row' }, [sectionHeading('credit-card', 'Debt overview', 'debts-heading'), headerAction].filter(Boolean)),
      body,
    ].filter(Boolean));
  }

  // Full (Debts view): a "Still owed" summary card (the one global
  // number), then — no outer container card — each debt as its own
  // card (.debt-row) with a "Make payment" button plus a pencil to edit
  // (in a popup) and a trash to delete. When there are no debts the
  // summary card's own note is the empty state, so the list's
  // placeholder line is dropped to avoid saying it twice.
  return el('div', { class: 'view-stack' }, [
    renderStillOwedCard(state),
    debts.length > 0 ? body : null,
    paymentPopup,
    editPopup,
  ].filter(Boolean));
}

/** The Debts view's single global number — total still owed across every
 *  debt (`getTotalDebtCents`), as a `renderStatCard` with a supporting
 *  line. Not shown in `compact` (dashboard) mode. */
function renderStillOwedCard(state) {
  const owing = getAllDebts(state).filter((debt) => !getDebtProgress(debt).isPaidOff).length;
  return renderStatCard({
    icon: 'credit-card',
    label: 'Still owed',
    value: formatCents(getTotalDebtCents(state)),
    tone: 'attention',
    note:
      owing === 0
        ? 'Nothing owed here — add one only if you want a payoff plan.'
        : `Across ${owing} ${owing === 1 ? 'debt' : 'debts'}`,
  });
}
