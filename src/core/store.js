// The application state store: getState / dispatch / subscribe.
//
// See docs/ARCHITECTURE.md §4 "Application state architecture". This is
// intentionally small — a single in-memory state tree, updated only
// through a pure reducer, with subscribers notified after each real
// change.
//
// Reducer contract: `reducer(state, action)` must be pure, and MUST
// return the *same* state reference when an action produces no change
// (e.g. completing a task that doesn't exist). The store uses reference
// equality to decide whether to notify subscribers, so a reducer that
// always returns a new object defeats the no-op optimization and the
// "don't re-render on no-op" guarantee documented in docs/TEST-PLAN.md.

/**
 * @template S
 * @param {(state: S, action: {type: string, [key: string]: unknown}) => S} reducer
 * @param {S} initialState
 */
export function createStore(reducer, initialState) {
  let state = initialState;
  const listeners = new Set();

  function getState() {
    return state;
  }

  function dispatch(action) {
    const nextState = reducer(state, action);
    if (nextState !== state) {
      state = nextState;
      // Snapshot so a listener unsubscribing (itself or another) during
      // notification doesn't skip or double-notify anyone.
      for (const listener of [...listeners]) {
        listener(state, action);
      }
    }
    return action;
  }

  /**
   * @param {(state: S, action: {type: string}) => void} listener
   * @returns {() => void} unsubscribe
   */
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { getState, dispatch, subscribe };
}
