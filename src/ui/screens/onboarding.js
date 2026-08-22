// A short, entirely optional first-run flow (Phase 7). One question at a
// time, centered on the screen — submitting a step's form (whether it's
// filled in or left blank) advances to the next one. "Skip for now" (top)
// still jumps straight to the dashboard from any step. No decisions are
// asked here beyond what's genuinely useful for a fast start (name, for
// the greeting; balance/savings; next payday incl. how often it repeats,
// and any others; bills, any number of them) — everything else stays
// reachable, not required, further down the dashboard (docs/PRODUCT.md
// §3).

import { el } from '../dom.js';
import { amountField } from '../components/amount-field.js';
import { renderBillForm } from '../components/bills-section.js';
import { parseAmountToCents, parseBalanceToCents, formatCents } from '../../core/money.js';
import { getLocalDateKey } from '../../core/date.js';
import { setCurrentBalanceAction, setSavingsAllocationAction } from '../../modules/budget/index.js';
import { createIncomeAction, getAllIncomes, INCOME_FREQUENCIES } from '../../modules/incomes/index.js';
import { createBillAction, getAllBills } from '../../modules/bills/index.js';
import { completeOnboardingAction, setDisplayNameAction } from '../../modules/settings/index.js';

// Which step is showing — transient UI state, deliberately outside the
// store (see docs/ARCHITECTURE.md §4). Resets to the start on reload;
// nothing is lost by that, since anything already saved on an earlier
// step is already in the store, independent of where this counter is.
let currentStep = 0;

const PAYDAY_FREQUENCY_LABEL = { 'one-time': 'One-time', weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly' };

function onboardingCard(title, description, children) {
  return el('section', { class: 'card', 'aria-labelledby': 'onboarding-step-heading' }, [
    el('h2', { id: 'onboarding-step-heading' }, title),
    description ? el('p', { class: 'section-description' }, description) : null,
    ...children,
  ].filter(Boolean));
}

function continueButton(label = 'Continue') {
  return el('div', { class: 'money-form__buttons' }, [el('button', { type: 'submit', class: 'btn btn--primary btn--small' }, label)]);
}

/** A compact "what's already been added" list — same row shape used by every other simple list in this app (money-item.js's own markup, not the component, since no actions are needed here). */
function addedItemsList(items) {
  if (items.length === 0) return null;
  return el(
    'ul',
    { class: 'money-list' },
    items.map((item) =>
      el('li', { class: 'money-item' }, [
        el('div', { class: 'money-item__body' }, [
          el('span', { class: 'money-item__title' }, item.title),
          el('span', { class: 'money-item__meta-text' }, item.meta),
        ]),
      ])
    )
  );
}

/** What's your name? — purely for greeting copy; entirely optional. */
function renderNameStep({ dispatch, goNext }) {
  const nameInput = el('input', { type: 'text', name: 'displayName', class: 'field__input', placeholder: 'Optional' });
  const label = el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'Your name'), nameInput]);
  const form = el('form', { class: 'money-form' }, [label, continueButton()]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (name) dispatch(setDisplayNameAction(name));
    goNext();
  });

  return onboardingCard('Your name', "So the dashboard can greet you by name — e.g. \"Good morning, Alex.\" Leave blank if you'd rather skip this.", [form]);
}

/** Current Balance + optional Current Savings — one combined form. */
function renderBasicsStep({ dispatch, goNext }) {
  const balance = amountField('Current balance', { name: 'balance' });
  const savings = amountField('Current savings (optional)', { name: 'savings' });
  const error = el('p', { class: 'field__error', role: 'alert' });

  const form = el('form', { class: 'money-form' }, [
    balance,
    savings,
    el('p', { class: 'field__hint' }, "Already have some saved? Enter it here — we'll count it as part of your total instead of subtracting it a second time from the balance above."),
    error,
    continueButton(),
  ]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    // Every field here is optional — a blank one is simply skipped, not an error.
    const balanceCents = balance.amountInput.value.trim() ? parseBalanceToCents(balance.amountInput.value) : undefined;
    const savingsCents = savings.amountInput.value.trim() ? parseAmountToCents(savings.amountInput.value) : undefined;

    if (balance.amountInput.value.trim() && balanceCents == null) {
      error.textContent = 'Current balance: enter a valid amount, like 150.00 or -40.00.';
      return;
    }
    if (savings.amountInput.value.trim() && savingsCents == null) {
      error.textContent = 'Current savings: enter a valid amount of 0 or more.';
      return;
    }
    error.textContent = '';

    if (balanceCents != null && savingsCents != null) {
      // Deliberately different from how Savings works everywhere else in
      // the app (see CLAUDE.md "Current status"): here, the user is
      // reporting their *current* real-world state — the balance they
      // just typed already has this savings amount set aside, separately.
      // Storing it as-is and then also subtracting it via
      // `savingsAllocationCents` in the Safe-to-Spend formula
      // (src/modules/safe-to-spend/calculation.js) would remove it
      // twice. Adding it back into the stored balance cancels that out,
      // so Safe-to-Spend nets back to exactly the figure the user
      // reported, not that figure minus their own savings again.
      dispatch(setCurrentBalanceAction(balanceCents + savingsCents));
      dispatch(setSavingsAllocationAction(savingsCents));
    } else {
      if (balanceCents != null) dispatch(setCurrentBalanceAction(balanceCents));
      if (savingsCents != null) dispatch(setSavingsAllocationAction(savingsCents));
    }

    goNext();
  });

  return onboardingCard('Current balance & savings', "What you have, and (optionally) what you're setting aside. Leave either blank if you're not ready.", [form]);
}

/**
 * Next payday(s) — amount + date + how often it repeats, now with a name
 * field (defaults to "Paycheck") and no auto-advance, so more than one
 * income source can be added here (e.g. a paycheck and a side job) — at
 * the user's request. Submitting the form adds one and stays on this
 * step; a separate "Continue" moves on whenever the user is done.
 */
function renderPaydayStep({ state, dispatch, now, goNext, requestRender }) {
  const incomes = getAllIncomes(state);
  const list = addedItemsList(incomes.map((income) => ({ title: income.name, meta: `${formatCents(income.amountCents)} · ${PAYDAY_FREQUENCY_LABEL[income.frequency] ?? income.frequency}` })));

  const nameInput = el('input', {
    type: 'text',
    name: 'incomeName',
    class: 'field__input',
    value: incomes.length === 0 ? 'Paycheck' : '',
    placeholder: 'e.g. "Paycheck", "Side gig"',
  });
  const nameField = el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'Name'), nameInput]);
  const amount = amountField('Amount', { name: 'paydayAmount' });
  const dateInput = el('input', { type: 'date', name: 'paydayDate', value: getLocalDateKey(now), class: 'field__input' });
  const dateField = el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'Next payday date'), dateInput]);
  const frequencySelect = el(
    'select',
    { name: 'paydayFrequency', class: 'field__input' },
    INCOME_FREQUENCIES.map((frequency) => el('option', { value: frequency, selected: frequency === 'monthly' || undefined }, PAYDAY_FREQUENCY_LABEL[frequency]))
  );
  const frequencyField = el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'How often'), frequencySelect]);
  const error = el('p', { class: 'field__error', role: 'alert' });

  const form = el('form', { class: 'money-form' }, [
    nameField,
    amount,
    dateField,
    frequencyField,
    error,
    el('div', { class: 'money-form__buttons' }, [el('button', { type: 'submit', class: 'btn btn--primary btn--small' }, incomes.length > 0 ? 'Add another income' : 'Add income')]),
  ]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!amount.amountInput.value.trim()) {
      error.textContent = 'Enter an amount, or use Continue below to skip this.';
      return;
    }
    const cents = parseAmountToCents(amount.amountInput.value);
    if (cents == null) {
      error.textContent = 'Enter a valid amount of 0 or more.';
      return;
    }
    error.textContent = '';
    dispatch(createIncomeAction({ amountCents: cents, nextDate: dateInput.value, frequency: frequencySelect.value, name: nameInput.value.trim() || 'Paycheck' }, { now }));
    requestRender?.(); // stay on this step — refreshes the added-so-far list and resets the form for another entry
  });

  const continueBtn = el(
    'button',
    { type: 'button', class: incomes.length > 0 ? 'btn btn--secondary btn--small' : 'link-button', onclick: goNext },
    incomes.length > 0 ? 'Continue' : "I don't have income to add right now"
  );

  return onboardingCard(
    'Next payday',
    'When and roughly how much, and how often it repeats — add as many income sources as you have. This is what Safe-to-Spend uses to figure out how long your money needs to last.',
    [list, form, continueBtn].filter(Boolean)
  );
}

/** Upcoming bills — reuses the real Bill form (a bill genuinely needs a name); add as many as you have, one at a time. */
function renderBillsStep({ state, dispatch, now, goNext, requestRender }) {
  const bills = getAllBills(state);
  const list = addedItemsList(bills.map((bill) => ({ title: bill.name, meta: formatCents(bill.amountCents) })));

  const form = renderBillForm({
    onSubmit: (input) => {
      dispatch(createBillAction(input, { now }));
      requestRender?.(); // stay on this step — refreshes the added-so-far list and resets the form for another entry
    },
  });

  const continueBtn = el(
    'button',
    { type: 'button', class: bills.length > 0 ? 'btn btn--secondary btn--small' : 'link-button', onclick: goNext },
    bills.length > 0 ? 'Continue' : "I don't have any bills to add right now"
  );

  return onboardingCard('Upcoming bills', 'Add one, or a few — you can always add more later.', [list, form, continueBtn].filter(Boolean));
}

/**
 * @param {object} options
 * @param {object} options.state
 * @param {Function} options.dispatch
 * @param {Date} [options.now]
 * @param {() => void} [options.requestRender]
 * @returns {HTMLElement}
 */
export function renderOnboarding({ state, dispatch, now = new Date(), requestRender }) {
  const finish = () => dispatch(completeOnboardingAction({ now }));
  const goNext = () => {
    currentStep += 1;
    requestRender?.();
  };

  const steps = [
    () => renderNameStep({ dispatch, goNext }),
    () => renderBasicsStep({ dispatch, goNext }),
    () => renderPaydayStep({ state, dispatch, now, goNext, requestRender }),
    () => renderBillsStep({ state, dispatch, now, goNext, requestRender }),
  ];

  const onLastStep = currentStep >= steps.length;
  const body = onLastStep
    ? el('section', { class: 'card onboarding-finish' }, [
        el('p', { class: 'section-description' }, "That's it — you can change any of this anytime."),
        el('button', { type: 'button', class: 'btn btn--primary', onclick: finish }, 'Finish setup'),
      ])
    : steps[currentStep]();

  return el('div', { class: 'screen screen--onboarding' }, [
    el('header', { class: 'onboarding-header' }, [
      el('h1', {}, "Let's set up your budget"),
      el('p', { class: 'section-description' }, 'A few quick questions, and every one is optional — fill in what you know now, skip the rest.'),
      onLastStep ? null : el('p', { class: 'onboarding-progress' }, `Step ${currentStep + 1} of ${steps.length}`),
      // Not shown on the finish screen — "Finish setup" there is already
      // the same action (completeOnboardingAction), so a second "Skip for
      // now" button next to it would just be a redundant duplicate.
      onLastStep ? null : el('button', { type: 'button', class: 'btn btn--secondary', onclick: finish }, 'Skip for now'),
    ].filter(Boolean)),
    body,
  ]);
}
