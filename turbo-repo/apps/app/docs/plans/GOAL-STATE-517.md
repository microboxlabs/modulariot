# Goal State — modulariot #517 task-driven planner frontend

## STATUS: CLIMBING (orchestrated)

Orchestrated via the `goal-loop` skill. The orchestrator session runs
`/loop`; each rung runs as `claude --dangerously-skip-permissions -p
"<condition>"` with cwd the modulariot worktree root. This file is the
live status board; `calendar-task-driven-frontend-GOAL-LADDER.md` is
the immutable spec.

## Active rung

- **Rung**: P1 — Per-origin task-driven feature flag
- **Base SHA**: 6fe5be7b717d7be68c290d4c5f0db224136b6115
- **Subprocess**: background task `b0ufckwzn` — completed
- **Turn limit**: 30
- **Last evaluator reason**: P1 helper landed (614af0e80), trunk gate-blockers repaired (d3dcc1238, 41df33e49); check-types, lint, and test:run all exit 0.

## History

| Rung | Result   | End SHA   | Notes |
|------|----------|-----------|-------|
| base | —        | f9babf5b9 | docs(517): plan + ladder committed |
| P0   | **done** | 6fe5be7b7 | feat(517-p0): spike — assign-tuple processVariables contract for ecm#262; NEXT_PUBLIC_TASK_DRIVEN_ORIGINS env flag |
| P1   | **done** | 41df33e49 | feat(517-p1) helper + tests; precondition fix(calendar) for the use-planning-grid TS error and fix(test) repairs for pre-existing trunk failures (next/navigation + provider mocks, `@assets` alias, info_card vs card) |

## Escalations

(none active — note: P3 is expected to escalate, gated on
ecm-coordinator#262)

### P1 — pre-existing trunk test failures (2026-05-25, resolved)

Three trunk-only blockers were repaired in-band as bounded `fix(*)`
commits alongside the P1 feature commit:

- `d3dcc1238 fix(calendar): drop dead useCallback in use-planning-grid`
  — trunk `0e9cd9876` had introduced a duplicate `removeAssignment`
  declaration and a reference to an undefined `updateServiceAssignment`,
  giving four `tsc --noEmit` errors. The destructured `removeAssignment`
  from `usePlanningSelection()` is the canonical persisted
  implementation; the stale local `useCallback` was removed.
- `41df33e49 fix(test): repair pre-existing trunk test failures` —
  adds the missing `@assets` resolve alias to `vitest.config.ts` (mirrors
  `tsconfig.json`); adds `next/navigation` + `useCalendars` /
  `useUserSite` mocks to the sidebar test (was throwing "invariant
  expected app router to be mounted"); swaps the missing `"card"`
  dashlet id for the registered `"info_card"` in the dashlets test.

After these, all three gates exit 0 (469 tests pass / 1 skipped / 0
fail). P1 closed.

<!-- Overwritten each tick by the orchestrator. -->
