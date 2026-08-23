// Schema version, empty-state shape, and migration registry for the
// persisted state tree. See docs/DATA-MODEL.md for the canonical shape
// and §7 "Schema versioning & migrations" for the policy this implements.
//
// The empty state below is the budget-product shape (docs/PRODUCT.md) —
// every collection empty, settings/budget at their defaults.

export const CURRENT_SCHEMA_VERSION = 8;

/** @returns the state tree for a brand-new install, at the current schema version. */
export function createEmptyState() {
  const now = new Date().toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: {
      createdAt: now,
      lastOpenedAt: now,
    },
    settings: {
      onboardingCompletedAt: null,
      displayName: null,
      theme: 'system',
      reducedMotion: false,
      currency: 'USD',
    },
    budget: {
      currentBalanceCents: 0,
      savingsAllocationCents: 0,
    },
    incomes: [],
    bills: [],
    plannedExpenses: [],
    expenses: [],
    categoryBudgets: [],
    incomeReceipts: [],
    billPayments: [],
    expenseDrafts: [],
  };
}

// Each migration transforms state from version (N-1) to version N, and is
// keyed by its *target* version. Per docs/DATA-MODEL.md §6, adding one
// means: bump CURRENT_SCHEMA_VERSION, add `[newVersion]: migrateFn` here,
// and describe the new shape in docs/DATA-MODEL.md, all in the same
// change.
//
// migrateFn shape: (state) => nextState — pure, prefers additive defaults
// over dropping data.

// v1 Task shape (pre-Phase-2, never shipped with a real Tasks UI):
//   { id, title, notes, createdAt, completedAt, dueAt, effortMinutes,
//     energy, context, goalId, source }
// v2 Task shape (Phase 2 — see docs/DATA-MODEL.md "Task"): adds status,
// priority, description, scheduledDate/Time, updatedAt; renames
// dueAt -> dueDate, effortMinutes -> estimatedMinutes, context -> category;
// drops energy/goalId/source (goalId/source will return, additively, when
// the Goals module's own migration lands).
function migrateTaskV1ToV2(task) {
  return {
    id: task.id,
    title: task.title,
    description: null,
    status: task.completedAt ? 'completed' : 'todo',
    priority: 'important',
    dueDate: task.dueAt ?? null,
    scheduledDate: null,
    scheduledTime: null,
    estimatedMinutes: task.effortMinutes ?? null,
    category: task.context ?? null,
    notes: task.notes ?? null,
    createdAt: task.createdAt,
    updatedAt: task.createdAt,
    completedAt: task.completedAt ?? null,
  };
}

// v2 -> v3: the product pivoted from a general life planner (Tasks,
// Routines, Calendar, Goals, Weekly Review) to a focused budget planner
// (docs/PRODUCT.md §9). The two shapes share no real data — a Task has no
// budget equivalent — so this migration deliberately *discards* the old
// tasks/routines/calendarEvents/money/goals/weeklyReviews collections
// rather than transform them, per the exception documented in
// docs/DATA-MODEL.md §7. `settings.payScheduleHint` (free-text) is
// likewise dropped — Income.nextDate replaces it with a structured value.
// What *does* carry over: meta and the settings fields that still apply
// (onboardingCompletedAt/displayName/theme/reducedMotion).
function migrateV2ToV3(state) {
  return {
    meta: state.meta,
    settings: {
      onboardingCompletedAt: state.settings?.onboardingCompletedAt ?? null,
      displayName: state.settings?.displayName ?? null,
      theme: state.settings?.theme ?? 'system',
      reducedMotion: state.settings?.reducedMotion ?? false,
    },
    budget: { currentBalanceCents: 0, savingsAllocationCents: 0, safetyBufferCents: 0 },
    incomes: [],
    bills: [],
    plannedExpenses: [],
  };
}

// v3 -> v4: adds the `expenses` collection (Phase 5 — Expense Tracking).
// Purely additive; nothing else changes shape. See docs/DATA-MODEL.md
// "Expense" and "Current Balance model".
function migrateV3ToV4(state) {
  return { ...state, expenses: state.expenses ?? [] };
}

// v4 -> v5: adds the `categoryBudgets` collection (Phase 6 — Budget
// Planning). Purely additive; nothing else changes shape. See
// docs/DATA-MODEL.md "CategoryBudget".
function migrateV4ToV5(state) {
  return { ...state, categoryBudgets: state.categoryBudgets ?? [] };
}

// v5 -> v6: adds the `incomeReceipts` collection — a real historical log
// of confirmed income (one record per "Mark received"), so an unbounded
// period ("All time") can sum actual received income instead of either a
// meaningless "every future paycheck forever" or a non-answer. Purely
// additive; nothing else changes shape. See docs/DATA-MODEL.md
// "IncomeReceipt".
function migrateV5ToV6(state) {
  return { ...state, incomeReceipts: state.incomeReceipts ?? [] };
}

// v6 -> v7: adds the `billPayments` collection — the Bill-side counterpart
// to `incomeReceipts`, a real historical log of confirmed payments (one
// record per "Mark paid"), so a period's "Money out" can include what was
// actually paid, not every bill merely *due* in that window. Purely
// additive; nothing else changes shape. See docs/DATA-MODEL.md
// "BillPayment".
function migrateV6ToV7(state) {
  return { ...state, billPayments: state.billPayments ?? [] };
}

// v7 -> v8: adds the `expenseDrafts` collection — the data behind "Brain
// dump" quick capture (docs/DATA-MODEL.md "ExpenseDraft"). Purely
// additive; nothing else changes shape.
function migrateV7ToV8(state) {
  return { ...state, expenseDrafts: state.expenseDrafts ?? [] };
}

const migrations = {
  2: (state) => ({ ...state, tasks: (state.tasks ?? []).map(migrateTaskV1ToV2) }),
  3: migrateV2ToV3,
  4: migrateV3ToV4,
  5: migrateV4ToV5,
  6: migrateV5ToV6,
  7: migrateV6ToV7,
  8: migrateV7ToV8,
};

/**
 * Runs `state` through every migration between its stored version and
 * `currentVersion`, in ascending order, and stamps the result with
 * `currentVersion`.
 *
 * `migrations`/`currentVersion` are overridable so this can be exercised
 * against a fake multi-step migration table in tests without touching the
 * real (currently empty) registry above.
 *
 * @param {{schemaVersion?: number, [key: string]: unknown}} state
 * @param {{migrations?: Record<number, (s: any) => any>, currentVersion?: number}} [options]
 */
export function migrate(state, options = {}) {
  const { migrations: migrationTable = migrations, currentVersion = CURRENT_SCHEMA_VERSION } = options;

  const fromVersion = typeof state.schemaVersion === 'number' ? state.schemaVersion : 0;

  if (fromVersion > currentVersion) {
    // Data from a newer build than this one understands. Refuse to guess
    // rather than silently drop fields this code doesn't know about yet —
    // the caller (the storage adapter) treats this as unrecoverable and
    // falls back to a fresh state.
    throw new Error(`stored schemaVersion ${fromVersion} is newer than supported version ${currentVersion}`);
  }

  let migrated = state;
  for (let v = fromVersion + 1; v <= currentVersion; v++) {
    const step = migrationTable[v];
    if (step) {
      migrated = step(migrated);
    }
  }

  return normalizeCollections({ ...migrated, schemaVersion: currentVersion });
}

// The list-shaped collections every list-entity reducer (src/core/
// list-entity.js) expects to be able to spread/index/findIndex into.
// Guaranteeing this once, here — the one place all persisted state passes
// through — means every reducer, selector, and the Safe-to-Spend
// calculation can trust these are always real arrays, even if the raw
// stored value degraded into something else (an object, a string, `null`)
// through hand-editing or a future bug. See Phase 8 QA (docs/QA-REPORT.md).
const ARRAY_COLLECTION_KEYS = ['incomes', 'bills', 'plannedExpenses', 'expenses', 'categoryBudgets', 'incomeReceipts', 'billPayments', 'expenseDrafts'];

function normalizeCollections(state) {
  const normalized = { ...state };
  for (const key of ARRAY_COLLECTION_KEYS) {
    if (!Array.isArray(normalized[key])) normalized[key] = [];
  }
  return normalized;
}
