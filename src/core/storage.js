// The storage adapter: the only module allowed to touch localStorage.
// See docs/ARCHITECTURE.md §5 "LocalStorage strategy" for the contract
// this implements — everything else in the app reads/writes persisted
// state through this module, never localStorage directly.
//
// Responsibilities:
//   - Safe JSON serialize/deserialize (never let a parse error crash the
//     app; corrupted data is preserved under a recovery key, not lost).
//   - Run the state through schema migration on load.
//   - Debounce writes so rapid interactions don't hammer localStorage.
//   - A soft size check that warns (via callback) well before the
//     browser's real storage quota.
//
// The `storage` backend (localStorage.getItem/setItem) is passed in
// rather than imported globally, per docs/ARCHITECTURE.md §4 ("no global
// mutable singletons reached via import") — this is also what lets the
// adapter be unit-tested under Node, which has no real localStorage.

import { migrate, createEmptyState } from './schema.js';

const DEFAULT_KEY = 'adhd-planner:v1';
const RECOVERY_KEY_SUFFIX = ':recovery';
const DEFAULT_DEBOUNCE_MS = 300;
// Conservative vs. typical browser localStorage quotas (often 5-10MB per
// origin) — warn well before the user could hit a real QuotaExceededError.
const DEFAULT_SOFT_LIMIT_BYTES = 4 * 1024 * 1024;

/**
 * @param {object} [options]
 * @param {{getItem: Function, setItem: Function, removeItem?: Function}} [options.storage]
 *   Defaults to the global `localStorage` when present (i.e. in a browser).
 * @param {string} [options.key] Root key the whole state tree is stored under.
 * @param {number} [options.debounceMs] Delay before a scheduled save flushes.
 * @param {number} [options.softLimitBytes] Size threshold that triggers onQuotaWarning.
 * @param {(approxBytes: number) => void} [options.onQuotaWarning]
 * @param {(rawValue: string) => void} [options.onCorruptData]
 */
export function createStorageAdapter({
  storage = typeof localStorage !== 'undefined' ? localStorage : undefined,
  key = DEFAULT_KEY,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  softLimitBytes = DEFAULT_SOFT_LIMIT_BYTES,
  onQuotaWarning,
  onCorruptData,
} = {}) {
  if (!storage) {
    throw new Error(
      'createStorageAdapter: no storage backend available (pass `storage`, or run where `localStorage` exists)'
    );
  }

  const recoveryKey = `${key}${RECOVERY_KEY_SUFFIX}`;
  let pendingState = null;
  let flushTimer = null;

  /** Reads and migrates the persisted state, or a fresh empty state if there is none / it's unusable. */
  function load() {
    let raw;
    try {
      raw = storage.getItem(key);
    } catch {
      // localStorage unavailable (disabled, some private-browsing modes):
      // degrade to an in-memory-only empty state rather than crash.
      return createEmptyState();
    }

    if (raw == null) {
      return createEmptyState();
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      recoverCorrupt(raw);
      return createEmptyState();
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      recoverCorrupt(raw);
      return createEmptyState();
    }

    try {
      return migrate(parsed);
    } catch {
      // e.g. a schemaVersion newer than this build supports.
      recoverCorrupt(raw);
      return createEmptyState();
    }
  }

  function recoverCorrupt(raw) {
    try {
      storage.setItem(recoveryKey, raw);
    } catch {
      // Best-effort only — if even this write fails, there's nothing more
      // to do; the caller still gets a safe empty state either way.
    }
    onCorruptData?.(raw);
  }

  /** Writes `state` immediately. Prefer `scheduleSave` for interactive use. */
  function save(state) {
    const serialized = JSON.stringify(state);
    storage.setItem(key, serialized);
    checkSize(serialized);
  }

  function checkSize(serialized) {
    if (!onQuotaWarning) return;
    // UTF-16 code units, 2 bytes each — a rough but cheap estimate, not
    // exact byte-accounting.
    const approxBytes = serialized.length * 2;
    if (approxBytes > softLimitBytes) {
      onQuotaWarning(approxBytes);
    }
  }

  /**
   * Queues `state` to be written after `debounceMs` of inactivity,
   * coalescing rapid successive calls into one write. Call `flush()`
   * before the page unloads so the last update isn't lost.
   */
  function scheduleSave(state) {
    pendingState = state;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, debounceMs);
  }

  /** Writes any pending scheduled save immediately, if one is queued. */
  function flush() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (pendingState !== null) {
      const toSave = pendingState;
      pendingState = null;
      save(toSave);
    }
  }

  return { load, save, scheduleSave, flush };
}
