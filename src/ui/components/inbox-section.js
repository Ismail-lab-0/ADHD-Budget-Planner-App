// The Inbox section — Brain Dump captures that haven't been turned into a
// real Expense yet or dismissed (docs/DATA-MODEL.md "ExpenseDraft"). See
// src/ui/components/brain-dump.js's header comment for why this is
// scoped to money (an inbox of *expense stubs*), not a general notes
// list. Items are never auto-deleted or auto-expired — they persist
// until "Convert to expense" or the dismiss action removes them.

import { el } from '../dom.js';
import { emptyState } from './empty-state.js';
import { renderMoneyItem } from './money-item.js';
import { renderExpenseForm } from './expenses-section.js';
import { renderPopup } from './popup.js';
import { sectionHeading, iconChip, iconButton } from './icons.js';
import { formatRelativeTime } from '../../core/date.js';
import { getExpenseDraftsSortedByRecent, deleteExpenseDraftAction } from '../../modules/expense-drafts/index.js';
import { createExpenseAction } from '../../modules/expenses/index.js';
import { canAddExpense } from '../demo-gate.js';

// Which draft (if any) is mid-conversion into a real Expense — transient
// UI state, deliberately outside the store (see docs/ARCHITECTURE.md §4),
// same convention as expenses-section.js's `editingExpenseId`.
let convertingDraftId = null;

function draftRow({ draft, now, dispatch, requestRender }) {
  return renderMoneyItem({
    icon: iconChip('zap'),
    title: draft.text,
    meta: [formatRelativeTime(draft.createdAt, now)],
    actions: [
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn--secondary btn--small',
          onclick: () => {
            convertingDraftId = draft.id;
            requestRender?.();
          },
        },
        'Convert to expense'
      ),
      iconButton(
        'trash',
        'Dismiss this note',
        () => {
          if (window.confirm("Dismiss this note? This can't be undone.")) {
            dispatch(deleteExpenseDraftAction(draft.id));
          }
        },
        { tone: 'attention' }
      ),
    ],
  });
}

/**
 * @param {object} options
 * @param {object} options.state
 * @param {Function} options.dispatch
 * @param {Date} [options.now]
 * @param {() => void} [options.requestRender]
 */
export function renderInboxSection({ state, dispatch, now = new Date(), requestRender }) {
  const drafts = getExpenseDraftsSortedByRecent(state);

  const list =
    drafts.length > 0
      ? el(
          'ul',
          { class: 'money-list' },
          drafts.map((draft) => draftRow({ draft, now, dispatch, requestRender }))
        )
      : emptyState('Nothing here yet — press N or tap + Brain dump to jot something down.');

  // Converting reuses the real Add Expense form (src/ui/components/
  // expenses-section.js), pre-filled with the note as the description —
  // see renderExpenseForm's `initialDescription` option. The draft is
  // only removed once the resulting Expense is actually saved, not the
  // moment "Convert to expense" is clicked — closing this popup without
  // submitting (Escape, the backdrop, the X) leaves the draft exactly
  // where it was, so an abandoned conversion never silently loses the
  // captured note.
  const convertingDraft = drafts.find((draft) => draft.id === convertingDraftId) ?? null;
  const closeConvert = () => {
    convertingDraftId = null;
    requestRender?.();
  };
  const popup = convertingDraft
    ? renderPopup({
        titleId: 'convert-to-expense-heading',
        title: 'Convert to expense',
        body: renderExpenseForm({
          state,
          initialDescription: convertingDraft.text,
          onSubmit: (input) => {
            // Demo build: if the limit is hit, show the limit modal and
            // leave the note untouched in the Inbox — the Inbox can't be
            // used to slip past the cap.
            if (!canAddExpense(state)) { closeConvert(); return; }
            dispatch(createExpenseAction(input, { now: new Date() }));
            dispatch(deleteExpenseDraftAction(convertingDraft.id));
            closeConvert();
          },
        }),
        onClose: closeConvert,
      })
    : null;

  return el(
    'section',
    { class: 'card', 'aria-labelledby': 'inbox-heading' },
    [sectionHeading('zap', 'Inbox', 'inbox-heading'), list, popup].filter(Boolean)
  );
}
