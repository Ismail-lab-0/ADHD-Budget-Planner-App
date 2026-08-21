# Product Specification

## 1. Product vision

ADHD Life Planner is a low-friction personal life-management application.
It is initially positioned for people with ADHD-related organizational
challenges, but the underlying design principle is broadly useful: a
planning tool should reduce the effort of running your life, not add to
it.

Guiding statement:

> **Your planner shouldn't become another thing you have to manage.**

## 2. Target problem

The problem is not "people need a planner." Planners, calendars, budgeting
spreadsheets, and to-do apps already exist in abundance. The actual problem
is that **all of them require ongoing maintenance from the user**:
continuously re-organizing, re-prioritizing, updating statuses, filing
things into the right category, reviewing and pruning. For someone whose
executive function makes sustained self-management difficult, that
maintenance overhead is often *harder* than the underlying tasks the
system was supposed to help with. The system itself becomes a source of
guilt and abandonment.

So the product's job is not "store the user's data." It's to carry as much
of the organizing, prioritizing, and maintaining burden as possible, so the
user mostly has to do two things: **capture** things quickly, and **act**
on what the app surfaces.

This is a productivity and organization tool. It does not diagnose,
treat, or make any medical claim about ADHD or any other condition — see
§7.

## 3. Core user experience

The product is organized around one loop:

```
CAPTURE → ORGANIZE → PRIORITIZE → ACT → REVIEW
```

- **Capture** — getting something out of the user's head and into the
  system must be as close to zero-friction as possible: minimal required
  fields, no forced categorization at capture time.
- **Organize** — the app does as much sorting/categorizing/scheduling as
  it reasonably can on the user's behalf, using simple heuristics and
  whatever structure the user *did* provide, rather than demanding it up
  front.
- **Prioritize** — the app decides what matters most *right now*, instead
  of asking the user to rank, tag priority levels, or maintain a manual
  order.
- **Act** — the user is shown a short, specific, doable next step, not a
  long list to pick from.
- **Review** — on a light cadence (weekly), the app helps the user notice
  patterns and reset, without requiring a full audit of everything they
  own.

### Design principles

1. **Do not maximize the number of features.** Every module must earn its
   place against the core loop. Breadth is a cost, not a benefit.
2. **Prioritize reducing user effort** over completeness, flexibility, or
   configurability. When a decision is between "more powerful" and "less
   effort," default to less effort.
3. **Answer questions, don't just display data.** This is the single most
   important interaction principle in the product. See examples below.
4. **Avoid overwhelming dashboards.** No screen should present more than
   the user needs to make their next decision.
5. **Use progressive disclosure.** Show the minimal, decision-relevant
   view by default; details and raw data are opt-in, one tap/click away,
   never the default.
6. **The Today screen is the center of the product.** Every module should
   be able to feed something into Today. A module that never surfaces
   there is suspect.
7. **No medical, diagnostic, or treatment claims about ADHD**, ever, in any
   surface of the product.

### "Answer, don't display" — the pattern

This is the core UX transformation the product applies to every module.
Instead of showing raw records, the app interprets them into a direct
answer to the question the user actually has.

| Instead of showing... | ...answer this question |
|---|---|
| "Here are your tasks." | "Here's what you should do next." |
| "Here are your financial transactions." | "Here's how much you can safely spend until payday." |
| "Here are your goals." | "Here's the next action for your goal." |
| "Here are your calendar events." | "Here's what's on today, and what needs prep." |
| "Here are your routines." | "Here's what's left in your routine right now." |

Every module spec below should be read through this lens: the list view is
the fallback/detail view, not the primary interface.

## 4. Main modules

Eventual scope — 11 modules. Not all are built at once; see
`docs/ROADMAP.md` for sequencing. Each module's *primary* surface is the
question it answers; each module also has a secondary, lower-friction
"see everything" view for when the user wants it.

1. **Today** — the home screen and product center. Aggregates the
   day-relevant output of every other module into one short, calm view:
   what's next, what's scheduled, what's left of today's routine, and
   whether spending is on track. This is not a separate feature so much
   as the composition layer over everything else.

2. **Tasks** — capture-first task list. Minimal required fields at
   capture (just a title). Optional structure (due date, effort, energy
   required, project/context) is layered on only if the user chooses to
   add it — never required to save a task.

3. **"What should I do next?"** — a single-purpose, on-demand answer
   engine. Given current time, energy/context signals the user is willing
   to give (optional), due dates, and staleness, it returns one
   task — not a ranked list — as the suggested next action. Re-askable at
   any time. This is the clearest embodiment of "prioritize for the
   user."

4. **Calendar** — time-anchored events. Read-mostly surface focused on
   "what's coming up and what needs prep," not a full calendar-app
   replacement.

5. **Routines** — repeatable checklist sequences (e.g. morning routine,
   wind-down routine) the user defines once and then just executes.
   Optimized for "show me the next step," not for authoring flexibility.

6. **Money** — a light transaction/account ledger. Deliberately not a
   full budgeting or accounting tool. Its purpose is to feed Safe-to-Spend
   and give a rough sense of where money is going, not double-entry
   bookkeeping.

7. **Safe-to-Spend** — a derived, always-current answer: "how much can I
   spend right now without jeopardizing upcoming known obligations before
   my next income event?" Computed from Money data plus known upcoming
   obligations; never manually maintained by the user as its own record.

8. **Goals** — long-horizon intentions, each broken down into "what's the
   next concrete action," surfaced through Tasks/Today rather than lived
   in a separate goal-tracking ritual.

9. **Weekly Review** — a short, guided, low-effort checkpoint (not an
   audit) that helps the user notice what's stale, what's done, and reset
   for the coming week, with the app pre-surfacing candidates rather than
   asking the user to review everything themselves.

10. **Onboarding** — a brief first-run flow that captures just enough to
    make Today, Next Action, and Safe-to-Spend useful immediately, without
    forcing full setup of every module up front. Progressive disclosure
    applies to onboarding itself.

11. **Data Backup / Import / Export** — since there's no backend and no
    account, this is the user's only durability guarantee. Must be
    reliable, human-inspectable (plain JSON), and low-friction (one
    action to export, one action to restore).

## 5. Non-goals

To keep the product from drifting into feature maximization:

- Not a full accounting/double-entry bookkeeping system.
- Not a full-featured calendar app (no recurring-event RFC parity, no
  scheduling/invite workflows, no multi-calendar sync).
- Not a project-management tool (no Gantt charts, dependency graphs,
  multi-user assignment).
- Not a habit-tracking analytics platform (routines are about execution,
  not streak dashboards).
- Not a social or multi-user product. Single user, single device
  (with export/import as the portability mechanism), at least through the
  scope currently planned.
- Not a medical, diagnostic, or therapeutic product.

## 6. Tone and voice

- Direct, calm, non-judgmental. Never guilt-trip about incomplete tasks,
  streak breaks, or unreviewed items.
- Say the useful thing plainly: "3 things are overdue" not "Uh oh! You're
  falling behind!"
- Never frame the user's difficulty organizing as a personal failing — the
  product's premise is that the *system*, not the person, has usually been
  the problem.
- No gamification pressure (no shame-based streaks, no red alarming
  badges for normal backlog).

## 7. ADHD claims policy

This product is a general organization and planning tool that happens to
be designed with ADHD-related executive-function challenges in mind. It
must never:

- Claim to diagnose ADHD or any condition.
- Claim to treat, manage, or improve symptoms of ADHD or any condition.
- Use clinical/medical language (e.g. "symptom," "treatment," "therapy,"
  "clinically proven") anywhere in the UI, marketing copy, or docs.
- Imply the app is a substitute for medical or professional advice.

Marketing/positioning language should stay in the register of "designed
for people who find traditional planners high-friction," not clinical
claims.
