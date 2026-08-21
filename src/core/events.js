// A minimal pub/sub event bus.
//
// See docs/ARCHITECTURE.md §4. Used for cross-module signals that aren't
// full state changes — e.g. "a routine instance finished" — so a module
// can react without owning another module's state. State-change
// notifications themselves go through the store's own `subscribe`
// (src/core/store.js), not this bus.

export function createEventBus() {
  /** @type {Map<string, Set<(payload: unknown) => void>>} */
  const handlers = new Map();

  /**
   * @param {string} event
   * @param {(payload: unknown) => void} handler
   * @returns {() => void} unsubscribe
   */
  function on(event, handler) {
    let set = handlers.get(event);
    if (!set) {
      set = new Set();
      handlers.set(event, set);
    }
    set.add(handler);
    return () => off(event, handler);
  }

  /**
   * @param {string} event
   * @param {(payload: unknown) => void} handler
   */
  function off(event, handler) {
    const set = handlers.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      handlers.delete(event);
    }
  }

  /**
   * @param {string} event
   * @param {unknown} [payload]
   */
  function emit(event, payload) {
    const set = handlers.get(event);
    if (!set) return;
    // Snapshot so a handler that unsubscribes (itself or another) mid-emit
    // doesn't skip or double-call handlers.
    for (const handler of [...set]) {
      handler(payload);
    }
  }

  return { on, off, emit };
}
