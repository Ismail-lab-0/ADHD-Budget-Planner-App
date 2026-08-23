export function getAllExpenseDrafts(state) {
  return Array.isArray(state?.expenseDrafts) ? state.expenseDrafts : [];
}

/** Most recent capture first — an inbox to work through, not a log read chronologically. */
export function getExpenseDraftsSortedByRecent(state) {
  return getAllExpenseDrafts(state)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
