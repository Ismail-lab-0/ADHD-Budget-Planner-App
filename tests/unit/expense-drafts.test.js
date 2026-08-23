// Tests for the Expense Drafts module — the data behind "Brain dump"
// quick capture (docs/DATA-MODEL.md "ExpenseDraft"): creation, deletion,
// sorting, invalid-input handling. See tests/unit/bills.test.js for the
// convention this follows.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  createExpenseDraftAction,
  deleteExpenseDraftAction,
  expenseDraftsReducer,
  getAllExpenseDrafts,
  getExpenseDraftsSortedByRecent,
} from '../../src/modules/expense-drafts/index.js';

const NOW = new Date('2026-08-23T09:00:00.000Z');

function seedDraft(overrides, now = NOW) {
  return expenseDraftsReducer([], createExpenseDraftAction({ text: 'Coffee with Sam', ...overrides }, { now }))[0];
}

describe('draft creation', () => {
  test('non-empty text is enough to create a valid draft', () => {
    const [draft] = expenseDraftsReducer([], createExpenseDraftAction({ text: 'Parking meter' }, { now: NOW }));
    assert.equal(draft.text, 'Parking meter');
    assert.equal(draft.createdAt, NOW.toISOString());
    assert.equal(draft.id.startsWith('ed_'), true);
  });

  test('leading/trailing whitespace is trimmed', () => {
    const [draft] = expenseDraftsReducer([], createExpenseDraftAction({ text: '  new tires  ' }, { now: NOW }));
    assert.equal(draft.text, 'new tires');
  });

  test('blank or missing text is refused (no confirmation-step error, just a no-op)', () => {
    assert.deepEqual(expenseDraftsReducer([], createExpenseDraftAction({ text: '' }, { now: NOW })), []);
    assert.deepEqual(expenseDraftsReducer([], createExpenseDraftAction({ text: '   ' }, { now: NOW })), []);
    assert.deepEqual(expenseDraftsReducer([], createExpenseDraftAction({}, { now: NOW })), []);
  });

  test('two drafts created back to back get distinct ids', () => {
    const d1 = seedDraft({ text: 'first' });
    const d2 = seedDraft({ text: 'second' });
    assert.notEqual(d1.id, d2.id);
  });
});

describe('draft deletion', () => {
  test('delete removes the draft (dismiss, or after a successful "Convert to expense")', () => {
    const draft = seedDraft();
    assert.deepEqual(expenseDraftsReducer([draft], deleteExpenseDraftAction(draft.id)), []);
  });

  test('deleting a nonexistent id is a no-op (same array reference)', () => {
    const drafts = [seedDraft()];
    assert.equal(expenseDraftsReducer(drafts, deleteExpenseDraftAction('missing')), drafts);
  });
});

describe('edits are not supported', () => {
  test('an update/toggle action is a no-op — drafts are only ever created or deleted', () => {
    const draft = seedDraft();
    const [afterUpdate] = expenseDraftsReducer([draft], { type: 'expenseDrafts/update', id: draft.id, changes: { text: 'hacked' }, now: NOW.toISOString() });
    assert.equal(afterUpdate.text, 'Coffee with Sam');
  });
});

describe('getAllExpenseDrafts', () => {
  test('reads the stored collection', () => {
    const drafts = [{ id: 'ed1' }];
    assert.equal(getAllExpenseDrafts({ expenseDrafts: drafts }), drafts);
  });

  test('tolerates a missing or corrupted collection, returning []', () => {
    assert.deepEqual(getAllExpenseDrafts({}), []);
    assert.deepEqual(getAllExpenseDrafts({ expenseDrafts: 'not an array' }), []);
  });
});

describe('getExpenseDraftsSortedByRecent', () => {
  test('most recently captured first', () => {
    const state = {
      expenseDrafts: [
        { id: 'ed1', text: 'oldest', createdAt: '2026-08-20T09:00:00.000Z' },
        { id: 'ed3', text: 'newest', createdAt: '2026-08-23T09:00:00.000Z' },
        { id: 'ed2', text: 'middle', createdAt: '2026-08-21T09:00:00.000Z' },
      ],
    };
    assert.deepEqual(getExpenseDraftsSortedByRecent(state).map((d) => d.id), ['ed3', 'ed2', 'ed1']);
  });

  test('does not mutate the stored collection', () => {
    const drafts = [
      { id: 'ed1', createdAt: '2026-08-20T09:00:00.000Z' },
      { id: 'ed2', createdAt: '2026-08-23T09:00:00.000Z' },
    ];
    getExpenseDraftsSortedByRecent({ expenseDrafts: drafts });
    assert.equal(drafts[0].id, 'ed1'); // original order untouched
  });
});
