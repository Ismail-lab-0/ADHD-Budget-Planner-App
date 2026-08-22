import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createId } from '../../src/core/id.js';

describe('createId', () => {
  test('produces unique ids across many rapid (synchronous) calls', () => {
    const ids = new Set();
    for (let i = 0; i < 10000; i++) {
      ids.add(createId());
    }
    assert.equal(ids.size, 10000);
  });

  test('includes the given prefix', () => {
    assert.match(createId('t'), /^t_/);
  });

  test('omits the prefix separator when no prefix is given', () => {
    assert.doesNotMatch(createId(), /^_/);
  });
});
