export function getAllBills(state) {
  return state.bills ?? [];
}

export function getUnpaidBills(state) {
  return getAllBills(state).filter((bill) => !bill.paid);
}
