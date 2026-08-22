import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createStorageAdapter } from '../../src/core/storage.js';
import { createEmptyState, CURRENT_SCHEMA_VERSION } from '../../src/core/schema.js';

/** A minimal in-memory stand-in for the browser's localStorage. */
function createMockStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
    _dump: () => Object.fromEntries(data),
  };
}

describe('createStorageAdapter', () => {
  test('load() with nothing stored yet returns a fresh empty state', () => {
    const storage = createMockStorage();
    const adapter = createStorageAdapter({ storage });
    const state = adapter.load();
    assert.equal(state.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.deepEqual(state.incomes, []);
  });

  test('save() then load() round-trips the exact state', () => {
    const storage = createMockStorage();
    const adapter = createStorageAdapter({ storage });
    const state = { ...createEmptyState(), settings: { ...createEmptyState().settings, displayName: 'Alex' } };

    adapter.save(state);
    const loaded = adapter.load();

    assert.deepEqual(loaded, state);
  });

  test('corrupted (unparseable) JSON falls back to an empty state without throwing', () => {
    const storage = createMockStorage({ 'adhd-planner:v1': '{ this is not valid json' });
    let corruptPayload;
    const adapter = createStorageAdapter({ storage, onCorruptData: (raw) => (corruptPayload = raw) });

    const state = adapter.load();

    assert.equal(state.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.deepEqual(state.incomes, []);
    assert.equal(corruptPayload, '{ this is not valid json');
  });

  test('corrupted data is preserved under a recovery key rather than lost', () => {
    const storage = createMockStorage({ 'adhd-planner:v1': 'not json at all' });
    const adapter = createStorageAdapter({ storage });

    adapter.load();

    assert.equal(storage.getItem('adhd-planner:v1:recovery'), 'not json at all');
  });

  test('valid JSON that is not an object (e.g. an array) is also treated as corrupt, not crashed on', () => {
    const storage = createMockStorage({ 'adhd-planner:v1': '[1,2,3]' });
    const adapter = createStorageAdapter({ storage });
    const state = adapter.load();
    assert.equal(state.schemaVersion, CURRENT_SCHEMA_VERSION);
  });

  test('a schemaVersion newer than this build supports recovers to empty rather than misreading data', () => {
    const storage = createMockStorage({
      'adhd-planner:v1': JSON.stringify({ schemaVersion: 9999, tasks: [] }),
    });
    const adapter = createStorageAdapter({ storage });
    const state = adapter.load();
    assert.equal(state.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.ok(storage.getItem('adhd-planner:v1:recovery'));
  });

  test('a getItem failure (storage unavailable) degrades to empty state instead of throwing', () => {
    const storage = {
      getItem: () => {
        throw new Error('storage disabled');
      },
      setItem: () => {},
    };
    const adapter = createStorageAdapter({ storage });
    assert.doesNotThrow(() => adapter.load());
  });

  test('scheduleSave debounces rapid calls into a single write, keeping the final value', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const storage = createMockStorage();
    let writeCount = 0;
    const originalSetItem = storage.setItem.bind(storage);
    storage.setItem = (...args) => {
      writeCount += 1;
      originalSetItem(...args);
    };
    const adapter = createStorageAdapter({ storage, debounceMs: 300 });

    adapter.scheduleSave({ ...createEmptyState(), incomes: [{ id: '1' }] });
    t.mock.timers.tick(100);
    adapter.scheduleSave({ ...createEmptyState(), incomes: [{ id: '1' }, { id: '2' }] });
    t.mock.timers.tick(100);
    adapter.scheduleSave({ ...createEmptyState(), incomes: [{ id: '1' }, { id: '2' }, { id: '3' }] });
    t.mock.timers.tick(300);

    assert.equal(writeCount, 1);
    assert.equal(adapter.load().incomes.length, 3);
  });

  test('flush() writes an in-flight scheduled save immediately (e.g. on page hide/unload)', () => {
    const storage = createMockStorage();
    const adapter = createStorageAdapter({ storage, debounceMs: 10_000 });

    adapter.scheduleSave({ ...createEmptyState(), incomes: [{ id: '1' }] });
    adapter.flush();

    assert.equal(adapter.load().incomes.length, 1);
  });

  test('flush() with nothing pending is a safe no-op', () => {
    const storage = createMockStorage();
    const adapter = createStorageAdapter({ storage });
    assert.doesNotThrow(() => adapter.flush());
  });

  test('a write past the soft size limit triggers onQuotaWarning', () => {
    const storage = createMockStorage();
    let warnedBytes;
    const adapter = createStorageAdapter({
      storage,
      softLimitBytes: 10,
      onQuotaWarning: (bytes) => (warnedBytes = bytes),
    });

    adapter.save(createEmptyState());

    assert.ok(warnedBytes > 10);
  });

  test('createStorageAdapter throws immediately if no storage backend is available', () => {
    assert.throws(() => createStorageAdapter({ storage: undefined }), /no storage backend/);
  });
});
