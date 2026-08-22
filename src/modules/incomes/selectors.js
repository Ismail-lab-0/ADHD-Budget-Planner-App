export function getAllIncomes(state) {
  return state.incomes ?? [];
}

export function getActiveIncomes(state) {
  return getAllIncomes(state).filter((income) => income.active);
}

/**
 * Active incomes not yet confirmed received — every recurring income
 * (which becomes "unreceived" again for its new cycle the moment
 * `nextDate` advances, see reducer.js), plus a one-time income only until
 * it's actually marked received.
 */
export function getUnreceivedIncomes(state) {
  return getActiveIncomes(state).filter((income) => !(income.frequency === 'one-time' && income.received));
}
