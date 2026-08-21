import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/core/store.js';

// A tiny counter reducer, deliberately following the required contract:
// return the *same* state object when an action is a no-op.
function counterReducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    case 'noop':
      return state;
    default:
      return state;
  }
}

describe('createStore', () => {
  test('dispatch produces correct new state', () => {
    const store = createStore(counterReducer, { count: 0 });
    store.dispatch({ type: 'increment' });
    assert.equal(store.getState().count, 1);
    store.dispatch({ type: 'increment' });
    assert.equal(store.getState().count, 2);
  });

  test('subscribe fires on a real state change', () => {
    const store = createStore(counterReducer, { count: 0 });
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.dispatch({ type: 'increment' });
    assert.equal(calls, 1);
  });

  test('subscribe does not fire on a no-op update', () => {
    const store = createStore(counterReducer, { count: 0 });
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.dispatch({ type: 'noop' });
    store.dispatch({ type: 'unknown-action' });
    assert.equal(calls, 0);
  });

  test('unsubscribe stops further notifications', () => {
    const store = createStore(counterReducer, { count: 0 });
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    store.dispatch({ type: 'increment' });
    unsubscribe();
    store.dispatch({ type: 'increment' });
    assert.equal(calls, 1);
  });

  test('listener unsubscribing itself mid-notification does not throw or skip others', () => {
    const store = createStore(counterReducer, { count: 0 });
    const order = [];
    let unsubscribeFirst;
    unsubscribeFirst = store.subscribe(() => {
      order.push('first');
      unsubscribeFirst();
    });
    store.subscribe(() => {
      order.push('second');
    });

    store.dispatch({ type: 'increment' });
    assert.deepEqual(order, ['first', 'second']);

    order.length = 0;
    store.dispatch({ type: 'increment' });
    assert.deepEqual(order, ['second']);
  });

  test('dispatch returns the dispatched action', () => {
    const store = createStore(counterReducer, { count: 0 });
    const action = { type: 'increment' };
    assert.equal(store.dispatch(action), action);
  });
});
