// The Expense Drafts module's public interface — the data behind "Brain
// dump" quick capture. Other modules/UI import from here — never from
// actions.js/reducer.js/selectors.js directly. See docs/ARCHITECTURE.md
// §7. Deliberately scoped to money, not a general notes list: every
// ExpenseDraft either becomes a real Expense (src/modules/expenses/) via
// "Convert to expense" or is dismissed — see
// src/ui/components/brain-dump.js and CLAUDE.md's "Current status" for
// the scope decision this followed (docs/PRODUCT.md §5's "not general
// task management" non-goal).

export { createExpenseDraftAction, deleteExpenseDraftAction } from './actions.js';
export { getAllExpenseDrafts, getExpenseDraftsSortedByRecent } from './selectors.js';
export { expenseDraftsReducer } from './reducer.js';
