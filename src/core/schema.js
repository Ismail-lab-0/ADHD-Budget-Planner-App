// Schema version, empty-state shape, and migration registry for the
// persisted state tree. See docs/DATA-MODEL.md for the canonical shape
// and §6 "Schema versioning & migrations" for the policy this implements.
//
// No entity modules (tasks, money, etc.) exist yet, so the empty state
// below only has the shape docs/DATA-MODEL.md §1 defines for an app with
// nothing captured — every collection empty, settings at their defaults.

export const CURRENT_SCHEMA_VERSION = 1;

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
      payScheduleHint: null,
      theme: 'system',
      reducedMotion: false,
    },
    tasks: [],
    routines: { templates: [], instances: [] },
    calendarEvents: [],
    money: { accounts: [], transactions: [], knownObligations: [] },
    goals: [],
    weeklyReviews: [],
  };
}

// Each migration transforms state from version (N-1) to version N, and is
// keyed by its *target* version. There is nothing to migrate yet — v1 is
// the only version that has ever existed — so this stays empty until the
// first real schema change. Per docs/DATA-MODEL.md §6, adding one means:
// bump CURRENT_SCHEMA_VERSION, add `[newVersion]: migrateFn` here, and
// describe the new shape in docs/DATA-MODEL.md, all in the same change.
//
// migrateFn shape: (state) => nextState — pure, prefers additive defaults
// over dropping data.
const migrations = {
  // 2: (state) => ({ ...state, ... }),
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

  return { ...migrated, schemaVersion: currentVersion };
}
