# Data Model

This document defines the shape of application state, what gets persisted
to `localStorage`, and how it evolves over time. It is a living spec:
schema changes must update this file in the same change that makes them
(see `CLAUDE.md`).

No entities below are implemented yet — this defines the target shape for
when each module's phase begins (see `docs/ROADMAP.md`).

## 1. Root state shape

Everything lives under a single `localStorage` key, e.g.
`adhd-planner:v1`, as one JSON object:

```jsonc
{
  "schemaVersion": 1,
  "meta": {
    "createdAt": "2026-08-19T00:00:00.000Z",
    "lastOpenedAt": "2026-08-19T00:00:00.000Z"
  },
  "settings": { /* see §3 Settings/Onboarding */ },
  "tasks": [ /* Task[] */ ],
  "routines": {
    "templates": [ /* RoutineTemplate[] */ ],
    "instances": [ /* RoutineInstance[] */ ]
  },
  "calendarEvents": [ /* CalendarEvent[] */ ],
  "money": {
    "accounts": [ /* Account[] */ ],
    "transactions": [ /* Transaction[] */ ],
    "knownObligations": [ /* Obligation[] */ ]
  },
  "goals": [ /* Goal[] */ ],
  "weeklyReviews": [ /* WeeklyReviewSnapshot[] */ ]
}
```

Notes:

- `schemaVersion` is the single number the storage adapter checks to
  decide whether to run migrations (§6).
- Nothing computed (Safe-to-Spend, Next Action, Today's aggregated view)
  is stored here — see §5.
- Flat top-level collections (arrays), not deeply nested trees, so
  individual entities are easy to find, update, and migrate independently.

## 2. Conventions used across all entities

- **IDs:** every entity has an `id: string`, generated client-side
  (timestamp + random component is sufficient — no UUID library
  dependency needed). IDs are never reused or recycled.
- **Timestamps:** stored as ISO 8601 UTC strings (`new
  Date().toISOString()`). Conversion to the user's local time/day
  boundaries happens only at render/derivation time, via the shared date
  utility in `/core/date.js` — never scattered ad hoc across modules, so
  "what day is it" logic has exactly one implementation.
- **Soft delete vs hard delete:** user-facing deletes are hard deletes
  (removed from the array). There is no trash/undo layer in initial
  scope — if that's wanted later, it's a deliberate addition, not an
  implicit one.
- **No cross-entity foreign-key enforcement layer.** References (e.g. a
  Task's `goalId`) are plain string IDs; a reference to a since-deleted
  entity should be handled gracefully at read time (treated as absent),
  not crash a selector.

## 3. Entities

### Task

```jsonc
{
  "id": "t_...",
  "title": "string, required — the only required field at capture",
  "notes": "string, optional",
  "createdAt": "ISO timestamp",
  "completedAt": "ISO timestamp | null",
  "dueAt": "ISO date or datetime | null",
  "effortMinutes": "number | null, optional rough size estimate",
  "energy": "'low' | 'medium' | 'high' | null, optional",
  "context": "string | null, optional free-form context tag (e.g. 'errand', 'computer')",
  "goalId": "string | null, present if this task is a goal's next action",
  "source": "'manual' | 'routine' | 'goal', how the task was created"
}
```

Design intent: only `title` is required to save a task. Every other field
exists to make the Next Action engine smarter *if* the user chooses to
provide it, never as a gate on capture.

### RoutineTemplate

```jsonc
{
  "id": "r_...",
  "name": "string",
  "steps": [ { "id": "string", "label": "string" } ],
  "schedule": "description of when this routine applies, e.g. 'daily', 'weekdays'",
  "active": true
}
```

### RoutineInstance

A single day's occurrence of a template, tracking step completion without
mutating the template.

```jsonc
{
  "id": "ri_...",
  "templateId": "r_...",
  "date": "YYYY-MM-DD (local day this instance belongs to)",
  "completedStepIds": ["string", "..."]
}
```

### CalendarEvent

```jsonc
{
  "id": "e_...",
  "title": "string",
  "startAt": "ISO datetime",
  "endAt": "ISO datetime | null",
  "allDay": "boolean",
  "notes": "string | null",
  "prepTask": "string | null, optional free-text prep reminder shown ahead of the event"
}
```

Intentionally no recurrence-rule engine, no multi-calendar/source concept
in initial scope (see Non-goals in `docs/PRODUCT.md`).

### Account (Money)

```jsonc
{
  "id": "a_...",
  "name": "string",
  "startingBalance": "number",
  "currency": "string, e.g. 'USD'"
}
```

### Transaction (Money)

```jsonc
{
  "id": "tx_...",
  "accountId": "a_...",
  "amount": "number, positive = income, negative = expense",
  "date": "ISO date",
  "description": "string",
  "category": "string | null, optional"
}
```

### Obligation (known upcoming, for Safe-to-Spend)

```jsonc
{
  "id": "o_...",
  "description": "string, e.g. 'Rent'",
  "amount": "number",
  "dueDate": "ISO date",
  "recurring": "'none' | 'weekly' | 'monthly'"
}
```

### Goal

```jsonc
{
  "id": "g_...",
  "title": "string",
  "why": "string | null, optional",
  "targetDate": "ISO date | null",
  "status": "'active' | 'done' | 'archived'",
  "nextActionTaskId": "string | null, points at the current Task representing the next step"
}
```

Design intent: a Goal's "next action" is a real Task (with `goalId` set
back-referencing this goal), not a separate parallel data structure — so
it shows up wherever Tasks/Today already know how to show a task.

### WeeklyReviewSnapshot

```jsonc
{
  "id": "wr_...",
  "weekOf": "ISO date, Monday of the reviewed week",
  "completedAt": "ISO timestamp",
  "summary": {
    "tasksCompleted": "number",
    "tasksCarriedOver": "number",
    "staleTaskIdsResolved": ["string", "..."]
  },
  "notes": "string | null, optional free-text reflection"
}
```

Kept intentionally light — a record that a review happened and a small
summary, not a full data dump.

### Settings / Onboarding

```jsonc
{
  "onboardingCompletedAt": "ISO timestamp | null",
  "displayName": "string | null, optional, used only for greeting copy",
  "payScheduleHint": "user-provided description used by Safe-to-Spend to estimate next income date",
  "theme": "'system' | 'light' | 'dark'",
  "reducedMotion": "boolean, mirrors/overrides prefers-reduced-motion if set explicitly"
}
```

## 4. Derived vs. stored data

The following are **never persisted** — they are pure functions computed
from the entities above at read time, owned by their respective module's
public selector functions (see `docs/ARCHITECTURE.md` §7):

- **Safe-to-Spend amount** — derived from `money.accounts`,
  `money.transactions`, and `money.knownObligations`.
- **"What should I do next" suggestion** — derived from `tasks` (and
  optionally current time/energy input), never stored as its own record.
- **Today's aggregated view** — derived by combining the above with
  `calendarEvents` and today's `RoutineInstance`.

Keeping these derived means they can never go stale relative to their
source data, and there is nothing to migrate for them when their
computation logic changes.

## 5. Export / Import format

- **Export** = the entire root state object (§1) serialized as pretty
  JSON, offered as a downloadable `.json` file (filename includes the
  export date, e.g. `adhd-planner-export-2026-08-19.json`).
- **Import** takes a JSON file in that same shape, validates
  `schemaVersion` and runs it through the same migration path as a normal
  load (§6), then requires explicit user confirmation before replacing
  current state (a destructive action — see `CLAUDE.md` on confirming
  hard-to-reverse actions).
- No partial import in initial scope (e.g. "import just tasks") — keeping
  export/import as a single whole-state operation keeps the format simple
  and matches its purpose (backup/restore/device transfer), not merging.

## 6. Schema versioning & migrations

- `schemaVersion` is a plain incrementing integer, starting at `1`.
- Any change to an entity's shape (renamed/removed/retyped field, changed
  meaning of a value) requires:
  1. Incrementing `schemaVersion`.
  2. Adding a migration function `migrateVFromTo(state)` in
     `/core/schema.js` that transforms the previous shape into the new
     one.
  3. Updating this document to describe the new shape.
- On load, the storage adapter reads the stored `schemaVersion` and runs
  every migration function in sequence up to the current version before
  the state reaches the store. Migrations must be pure and non-destructive
  where at all possible (prefer additive defaults over dropping data).
- Purely additive changes (new optional field with a safe default) still
  bump the version and get a trivial migration (`state => ({ ...state,
  newField: defaultValue })`) so the version number always accurately
  reflects the shape in storage — no silent "close enough" shapes.

## 7. Id generation

A single helper in `/core/id.js`, used by every module — no per-module
reimplementation. Sufficient uniqueness for a single-user, single-device
app: timestamp + random suffix (e.g. `t_${Date.now().toString(36)}_${
Math.random().toString(36).slice(2, 8)}`). No UUID dependency needed.
