// The Incomes module's public interface. Other modules/UI import from
// here — never from actions.js/reducer.js/selectors.js directly. See
// docs/ARCHITECTURE.md §7.

export { createIncomeAction, updateIncomeAction, deleteIncomeAction, toggleIncomeActiveAction, markIncomeReceivedAction } from './actions.js';
export { getAllIncomes, getActiveIncomes, getUnreceivedIncomes } from './selectors.js';
export { incomesReducer, INCOME_FREQUENCIES } from './reducer.js';
export { computeIncomeBalanceDelta } from './balance-effect.js';
