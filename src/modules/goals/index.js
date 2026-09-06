// The Goals module's public interface. Other modules/UI import from here
// — never from actions.js/reducer.js/selectors.js directly. See
// docs/ARCHITECTURE.md §7.

export { createGoalAction, updateGoalAction, deleteGoalAction } from './actions.js';
export { getAllGoals, getTotalGoalsSavedCents, getGoalProgress } from './selectors.js';
export { goalsReducer } from './reducer.js';
