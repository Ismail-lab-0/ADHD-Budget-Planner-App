export function getCurrentBalanceCents(state) {
  return state.budget?.currentBalanceCents ?? 0;
}

export function getSavingsAllocationCents(state) {
  return state.budget?.savingsAllocationCents ?? 0;
}
