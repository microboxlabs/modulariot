# Goal State — modulariot #517 task-driven planner frontend

## STATUS: BLOCKED (P1 — pre-existing trunk test failures)

Orchestrated via the `goal-loop` skill. The orchestrator session runs
`/loop`; each rung runs as `claude --dangerously-skip-permissions -p
"<condition>"` with cwd the modulariot worktree root. This file is the
live status board; `calendar-task-driven-frontend-GOAL-LADDER.md` is
the immutable spec.

## Active rung

- **Rung**: P1 — Per-origin task-driven feature flag
- **Base SHA**: 6fe5be7b717d7be68c290d4c5f0db224136b6115
- **Subprocess**: background task `b0ufckwzn` — escalated
- **Turn limit**: 30
- **Last evaluator reason**: P1 helper + tests landed and pass; check-types and lint both clean; **`test:run` exit non-zero on pre-existing trunk-only failures (18 tests across `sidebar-navigation-context.test.tsx` and `dashboard/dashlets/index.test.ts`)** unrelated to P1. See "Escalations" below.

## History

| Rung | Result   | End SHA   | Notes |
|------|----------|-----------|-------|
| base | —        | f9babf5b9 | docs(517): plan + ladder committed |
| P0   | **done** | 6fe5be7b7 | feat(517-p0): spike — assign-tuple processVariables contract for ecm#262; NEXT_PUBLIC_TASK_DRIVEN_ORIGINS env flag |
| P1   | **blocked** | 614af0e80 | feat(517-p1) helper + tests committed; gate (c) `test:run` blocked by pre-existing trunk failures (see Escalations) |

## Escalations

### P1 — pre-existing trunk test failures (2026-05-25)

`feat(517-p1): add per-origin task-driven flag helper` (614af0e80) and
the precondition `fix(calendar): drop dead useCallback in
use-planning-grid` (d3dcc1238) land cleanly. Gate (c) requirements:

- `npm run check-types` — **exits 0** (after the fix(calendar)
  precondition; the duplicate `removeAssignment` declaration introduced
  by trunk `0e9cd9876 feat(calendar): persist remove-assignment to
  backend` was breaking `tsc --noEmit`).
- `npm run lint` — **exits 0** (warnings only).
- `npm run test:run` — **exits 1**: 18 failures in 2 test files that
  fail at base SHA `6fe5be7b7` (and on trunk) unrelated to P1:
  - `src/features/layout/context/sidebar-navigation-context.test.tsx`
    (15/16 fail): `useRouter()` is called in the provider but the test
    setup never mounts a Next.js app router context — `Error:
    invariant expected app router to be mounted` from
    `next/src/client/components/navigation.ts:179`.
  - `src/features/dashboard/dashlets/index.test.ts` (3/21 fail):
    `getDashlet("card")` returns undefined (no `cardDefinition` in
    `DASHLET_REGISTRY`) and `canNestIn("card", "container", ...)`
    therefore returns false — the test expects "card" to be a
    registered dashlet but the registry does not include it.

Both failures predate the 517 branch and require fixes outside the P1
scope (`turbo-repo/apps/app/src/**` only, no behavior change): one
needs a `next/navigation` mock in `src/test/setup.ts` and the other
needs either the missing `card` dashlet added to the registry or the
test updated — neither is a P1 task. Per the GOAL-LADDER Contract's
escalation rule ("pre-existing trunk failure → write STATUS: BLOCKED
and stop"), P1 stops here pending an out-of-band fix or an explicit
broaden of P1's scope to cover the test repair.

Note: P3 is still expected to escalate separately, gated on
ecm-coordinator#262.

<!-- Overwritten each tick by the orchestrator. -->
