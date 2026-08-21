import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createEventBus } from '../../src/core/events.js';

describe('createEventBus', () => {
  test('on/emit calls the handler with the payload', () => {
    const bus = createEventBus();
    let received;
    bus.on('routine/step-completed', (payload) => {
      received = payload;
    });
    bus.emit('routine/step-completed', { stepId: 's1' });
    assert.deepEqual(received, { stepId: 's1' });
  });

  test('emit with no listeners for the event is a no-op, not an error', () => {
    const bus = createEventBus();
    assert.doesNotThrow(() => bus.emit('nobody-listens', 'payload'));
  });

  test('multiple handlers on the same event all fire', () => {
    const bus = createEventBus();
    const calls = [];
    bus.on('x', () => calls.push('a'));
    bus.on('x', () => calls.push('b'));
    bus.emit('x');
    assert.deepEqual(calls, ['a', 'b']);
  });

  test('off removes only the given handler', () => {
    const bus = createEventBus();
    const calls = [];
    const handlerA = () => calls.push('a');
    const handlerB = () => calls.push('b');
    bus.on('x', handlerA);
    bus.on('x', handlerB);
    bus.off('x', handlerA);
    bus.emit('x');
    assert.deepEqual(calls, ['b']);
  });

  test('the unsubscribe function returned by on() removes the handler', () => {
    const bus = createEventBus();
    const calls = [];
    const unsubscribe = bus.on('x', () => calls.push('a'));
    unsubscribe();
    bus.emit('x');
    assert.deepEqual(calls, []);
  });

  test('a handler removing itself mid-emit does not skip or double-call others', () => {
    const bus = createEventBus();
    const calls = [];
    let unsubscribeFirst;
    unsubscribeFirst = bus.on('x', () => {
      calls.push('first');
      unsubscribeFirst();
    });
    bus.on('x', () => calls.push('second'));

    bus.emit('x');
    assert.deepEqual(calls, ['first', 'second']);

    calls.length = 0;
    bus.emit('x');
    assert.deepEqual(calls, ['second']);
  });

  test('a handler removing another handler mid-emit still calls the removed handler for this emit (snapshotted)', () => {
    const bus = createEventBus();
    const calls = [];
    const handlerB = () => calls.push('b');
    bus.on('x', () => {
      calls.push('a');
      bus.off('x', handlerB);
    });
    bus.on('x', handlerB);

    bus.emit('x');
    // Snapshot semantics: the emit in progress already captured handlerB,
    // so it still runs once this round; only the *next* emit reflects the
    // removal.
    assert.deepEqual(calls, ['a', 'b']);

    calls.length = 0;
    bus.emit('x');
    assert.deepEqual(calls, ['a']);
  });
});
