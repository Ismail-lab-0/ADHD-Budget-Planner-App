// The Goals view — a dedicated screen for savings goals (a "sinking
// fund" per target: an emergency fund, a new laptop). Replaces the
// former Budget tab; Current Balance and Savings moved to the sidebar
// footer (src/ui/components/sidebar.js). Each goal is its own card with a
// progress bar toward its target, plus a pencil to edit (inline form) and
// a trash to delete — the same shape as the Debts view. Adding is via the
// green "+ Add a goal" button in the view header.
//
// A goal's "already put away" amount is protected/committed money — it
// reduces Safe-to-Spend, the same as the Savings figure
// (docs/SAFE-TO-SPEND.md §3d). Creating a goal never debits Current
// Balance (also like Savings); the formula just reads `state.goals`.

import { el } from '../dom.js';
import { renderAppFrame } from '../components/app-frame.js';
import { renderPopup } from '../components/popup.js';
import { emptyState } from '../components/empty-state.js';
import { amountField } from '../components/amount-field.js';
import { icon, iconButton } from '../components/icons.js';
import { formatCents, parseAmountToCents } from '../../core/money.js';
import { getAllGoals, getGoalProgress, createGoalAction, updateGoalAction, deleteGoalAction } from '../../modules/goals/index.js';

// Transient UI state (see docs/ARCHITECTURE.md §4): which goal row is
// being edited inline, and whether the "Add a goal" popup is open.
let editingGoalId = null;
let addGoalOpen = false;

/**
 * The add / edit form for a goal — Name, Amount needed, Already put
 * away, Monthly pace. Buttons: "Add this goal" (primary) / "Save" on
 * edit, and always a "Cancel" (secondary), matching the add-expense /
 * add-debt forms.
 * @param {object} options
 * @param {object|null} [options.goal]
 * @param {(input: object) => void} options.onSubmit
 * @param {() => void} options.onCancel
 */
export function renderGoalForm({ goal = null, onSubmit, onCancel }) {
  const isEdit = goal != null;

  const nameInput = el('input', {
    type: 'text',
    name: 'name',
    class: 'field__input',
    placeholder: 'What it’s for, e.g. "Emergency fund"',
    value: goal?.name ?? '',
    'aria-label': 'Goal name',
  });
  const nameLabel = el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'Name'), nameInput]);

  const target = amountField('Amount needed', { name: 'targetCents', valueCents: goal?.targetCents ?? null });
  const saved = amountField('Already put away', { name: 'savedCents', valueCents: goal?.savedCents ?? null });
  const pace = amountField('Pace (roughly, per month)', { name: 'monthlyPaceCents', valueCents: goal?.monthlyPaceCents ?? null });

  const error = el('p', { class: 'field__error', role: 'alert' });

  const form = el('form', { class: 'money-form' }, [
    nameLabel,
    target,
    saved,
    pace,
    error,
    el('div', { class: 'money-form__buttons' }, [
      el('button', { type: 'submit', class: 'btn btn--primary btn--small' }, isEdit ? 'Save' : 'Add this goal'),
      el('button', { type: 'button', class: 'btn btn--secondary btn--small', onclick: () => onCancel() }, 'Cancel'),
    ]),
  ]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = nameInput.value.trim();
    const targetCents = parseAmountToCents(target.amountInput.value);
    const savedCents = parseAmountToCents(saved.amountInput.value);
    const paceRaw = pace.amountInput.value.trim();
    const monthlyPaceCents = paceRaw === '' ? null : parseAmountToCents(paceRaw);

    if (!name) {
      error.textContent = 'Give the goal a name.';
      return;
    }
    if (targetCents == null || savedCents == null) {
      error.textContent = 'Enter valid amounts (0 or more) for what’s needed and what’s put away.';
      return;
    }
    if (paceRaw !== '' && monthlyPaceCents == null) {
      error.textContent = 'Pace must be a valid amount, or left blank.';
      return;
    }
    error.textContent = '';
    onSubmit({ name, targetCents, savedCents, monthlyPaceCents });
    if (!isEdit) {
      nameInput.value = '';
      target.amountInput.value = '';
      saved.amountInput.value = '';
      pace.amountInput.value = '';
    }
  });

  return form;
}

function goalRow({ goal, dispatch, requestRender }) {
  const progress = getGoalProgress(goal);
  const percent = Math.round(progress.percentSaved);

  const top = el('div', { class: 'goal-row__top' }, [
    el('span', { class: 'goal-row__name' }, goal.name),
    el('span', { class: 'goal-row__percent' }, progress.isReached ? 'Reached 🎉' : `${percent}%`),
  ]);

  const bar = el('div', { class: 'goal-row__bar' }, [
    el('div', { class: 'goal-row__bar-fill', style: `width: ${progress.percentSaved}%` }),
  ]);

  const amounts = el('div', { class: 'goal-row__amounts' }, `${formatCents(goal.savedCents)} of ${formatCents(goal.targetCents)}`);

  const bodyChildren = [top, bar, amounts];

  if (goal.monthlyPaceCents != null && goal.monthlyPaceCents > 0) {
    const paceText = progress.monthsToGo
      ? `~${formatCents(goal.monthlyPaceCents)}/month · about ${progress.monthsToGo} month${progress.monthsToGo === 1 ? '' : 's'} to go`
      : `~${formatCents(goal.monthlyPaceCents)}/month`;
    bodyChildren.push(el('p', { class: 'goal-row__pace' }, paceText));
  }

  const actions = el('div', { class: 'goal-row__actions' }, [
    iconButton('edit', `Edit ${goal.name}`, () => {
      editingGoalId = goal.id;
      requestRender?.();
    }),
    iconButton(
      'trash',
      `Delete ${goal.name}`,
      () => {
        if (window.confirm(`Delete "${goal.name}"? This can't be undone.`)) {
          dispatch(deleteGoalAction(goal.id));
        }
      },
      { tone: 'attention' }
    ),
  ]);

  return el('li', { class: `goal-row${progress.isReached ? ' goal-row--reached' : ''}` }, [
    el('div', { class: 'goal-row__body' }, bodyChildren),
    actions,
  ]);
}

export function renderGoalsView({ state, dispatch, now = new Date(), requestRender }) {
  const goals = getAllGoals(state);
  const closeAdd = () => {
    addGoalOpen = false;
    requestRender?.();
  };

  const addButton = el(
    'button',
    { type: 'button', class: 'btn btn--primary btn--small', onclick: () => { addGoalOpen = true; requestRender?.(); } },
    '+ Add a goal'
  );

  const list =
    goals.length > 0
      ? el('ul', { class: 'goal-list' }, goals.map((goal) => goalRow({ goal, dispatch, requestRender })))
      : emptyState('No goals yet — use "+ Add a goal" to set your first target.');

  const popup = addGoalOpen
    ? renderPopup({
        titleId: 'add-goal-heading',
        title: 'Add a goal',
        body: renderGoalForm({
          onSubmit: (input) => {
            dispatch(createGoalAction(input, { now }));
            closeAdd();
          },
          onCancel: closeAdd,
        }),
        onClose: closeAdd,
      })
    : null;

  const editing = editingGoalId ? goals.find((g) => g.id === editingGoalId) : null;
  const closeEdit = () => {
    editingGoalId = null;
    requestRender?.();
  };
  const editPopup = editing
    ? renderPopup({
        titleId: 'edit-goal-heading',
        title: 'Edit goal',
        body: renderGoalForm({
          goal: editing,
          onSubmit: (changes) => {
            dispatch(updateGoalAction(editing.id, changes, { now }));
            closeEdit();
          },
          onCancel: closeEdit,
        }),
        onClose: closeEdit,
      })
    : null;

  return renderAppFrame({
    state,
    dispatch,
    requestRender,
    activeView: 'goals',
    title: 'Goals',
    titleAction: addButton,
    body: el('div', {}, [list, popup, editPopup].filter(Boolean)),
  });
}
