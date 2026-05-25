# Task-driven planner frontend — Goal Ladder (modulariot #517)

Drives the frontend repoint in `calendar-task-driven-frontend.md` with
the `/goal` plugin, via the `goal-loop` skill. Each rung = one phase =
one `/goal` = one session. Branch: `based/517-task-driven-planner-frontend`.

## Status legend
`todo` / `in_progress` / `blocked` / `done`

| Rung | Phase | Status |
|------|-------------------------------------------|------|
| P0   | Spike — variable propagation + flag source | todo |
| P1   | Per-origin task-driven feature flag        | todo |
| P2   | Plan / unplan task-driven behind the flag  | todo |
| P3   | Assign / unassign task-driven (needs ecm#262) | todo |
| P4   | Dev end-to-end verification + docs         | todo |

## Contract

- Design source of truth:
  `turbo-repo/apps/app/docs/plans/calendar-task-driven-frontend.md`.
- `docs/plans/GOAL-STATE-517.md` (created beside this file at climb
  start) is the live status board; this ladder is the immutable spec.
- Each rung records its base SHA (`git rev-parse HEAD`) on turn 1.
- **Gates** (run from `turbo-repo/apps/app`, stop on first failure):
  `npm run check-types`, `npm run lint`, `npm run test:run`. If
  `node_modules` is missing, `npm install` at the turbo-repo root first.
- **Hard rules**: editable paths are `turbo-repo/apps/app/src/**` and
  `turbo-repo/apps/app/docs/**` only; never touch other apps/packages,
  never touch the `ecm-coordinator` repo, never edit `*.bpmn*`; no
  barrel/`index.ts` files; ≤5 files per commit; no secrets; no
  force-push; no merge.
- **Escalation**: on a genuine architecture choice, a pre-existing trunk
  failure, a needed dependency/environment, or a turn-limit hit — write
  `STATUS: BLOCKED` + reason to `docs/plans/GOAL-STATE-517.md` and stop.
- Per-rung / cross-rung contract: see the `goal-loop` skill.

---

## P0 — Spike: variable propagation + flag source

- **Status**: todo

```
/goal Follow turbo-repo/apps/app/docs/plans/calendar-task-driven-frontend.md Phase 0 and the
Contract section of turbo-repo/apps/app/docs/plans/calendar-task-driven-frontend-GOAL-LADDER.md.
On branch based/517-task-driven-planner-frontend, rung P0 is achieved when ALL hold:
(a) turbo-repo/apps/app/docs/plans/calendar-task-driven-frontend-P0-spike.md exists and
    records, with file/line evidence: (i) how the assign resource tuple
    (carrier/driver/truck/trailer/tipo_servicio) will reach the ECM workflow as PROCESS
    variables on the assignDriver->presentDriver move — i.e. the concrete contract the ECM
    companion issue ecm-coordinator#262 must implement; (ii) the chosen per-origin
    task-driven feature-flag source the frontend will read;
(b) it is a decision/spike document only — NO production code changed (only the spike doc
    under docs/plans/);
(c) git log shows >=1 commit since base SHA <P0_BASE_SHA> whose message matches `feat(517-p0):`.
Constraints: edit only turbo-repo/apps/app/docs/**; do not touch the ecm-coordinator repo;
<=5 files per commit. Stop after 20 turns if not achieved.
```

## P1 — Per-origin task-driven feature flag

- **Status**: todo

```
/goal Follow calendar-task-driven-frontend.md Phase 1, the P0 spike doc, and the Contract
section of the ladder. On branch based/517-task-driven-planner-frontend, rung P1 is achieved
when ALL hold:
(a) the frontend can determine "is origin X task-driven?" via the flag source chosen in the
    P0 spike, defaulting to OFF for every origin; it is exposed as a small typed helper/hook
    under turbo-repo/apps/app/src/features/calendar/;
(b) NO behavior change yet — no plan/assign/unplan/unassign path reads the flag in this rung;
(c) gates pass: from turbo-repo/apps/app, `npm run check-types`, `npm run lint`,
    `npm run test:run` all exit 0, with unit tests covering the helper (flag on / off /
    unknown origin);
(d) git log shows >=1 commit since base SHA <P1_BASE_SHA> matching `feat(517-p1):`.
Constraints: edit only turbo-repo/apps/app/src/** and docs/**; no barrel/index.ts files;
do not touch the ecm-coordinator repo; <=5 files per commit. Stop after 30 turns.
```

## P2 — Plan / unplan task-driven behind the flag

- **Status**: todo

```
/goal Follow calendar-task-driven-frontend.md Phase 2 (section 4.3) and the Contract section
of the ladder. On branch based/517-task-driven-planner-frontend, rung P2 is achieved when
ALL hold:
(a) when the per-origin flag is ON for a service's origin, the PLAN and UNPLAN paths skip the
    ECM binding calls — no runCalendarBinding (bookings BFF) and no notifyCalendarBinding
    (stage "none") — and rely solely on the workflow task move; the dead booking-compensation
    branch is removed cleanly for the flag-on path;
(b) when the flag is OFF, the plan/unplan behavior is byte-for-byte unchanged;
(c) gates pass: `npm run check-types`, `npm run lint`, `npm run test:run` exit 0, with tests
    covering flag-on (no binding call) and flag-off (unchanged) for plan and unplan;
(d) git log shows >=1 commit since base SHA <P2_BASE_SHA> matching `feat(517-p2):`.
Constraints: edit only turbo-repo/apps/app/src/** and docs/**; no barrel/index.ts files;
do not touch the ecm-coordinator repo; <=5 files per commit. Stop after 35 turns.
```

## P3 — Assign / unassign task-driven  *(depends on ecm-coordinator#262)*

- **Status**: todo

```
/goal Follow calendar-task-driven-frontend.md Phase 3 (section 4.3, 4.4) and the Contract
section of the ladder. On branch based/517-task-driven-planner-frontend, rung P3 is achieved
when ALL hold:
(a) when the per-origin flag is ON, the ASSIGN path moves assignDriver->presentDriver
    carrying the resource tuple (carrier/driver/truck/trailer/tipo_servicio) per the contract
    in the P0 spike doc, and the UNASSIGN path moves presentDriver->assignDriver — both with
    NO ECM binding call; flag-off behavior byte-for-byte unchanged;
(b) gates pass: `npm run check-types`, `npm run lint`, `npm run test:run` exit 0, with tests
    covering flag-on assign/unassign and flag-off unchanged;
(c) git log shows >=1 commit since base SHA <P3_BASE_SHA> matching `feat(517-p3):`.
HARD DEPENDENCY: this rung needs ecm-coordinator#262 (assign resources -> workflow process
variables) merged. Before doing anything, check whether #262 is merged
(`gh issue view 262 --repo microboxlabs/ecm-coordinator --json state,closed`). If it is NOT
merged/closed, write STATUS: BLOCKED plus the reason to docs/plans/GOAL-STATE-517.md and stop
WITHOUT changing code. Constraints: edit only turbo-repo/apps/app/src/** and docs/**; no
barrel/index.ts files; do not touch the ecm-coordinator repo; <=5 files per commit. Stop
after 35 turns.
```

## P4 — Dev end-to-end verification + docs

- **Status**: todo

```
/goal Follow calendar-task-driven-frontend.md Phase 4 and the Contract section of the ladder.
On branch based/517-task-driven-planner-frontend, rung P4 is achieved when ALL hold:
(a) turbo-repo/apps/app/docs/ calendar feature docs are updated to describe the task-driven
    planner and the per-origin flag;
(b) a verification record (docs/plans/calendar-task-driven-frontend-P4-validation.md) lists
    the plan/assign/unplan/unassign checks for a flag-on and a flag-off origin — run against
    the dev environment if reachable, otherwise a documented manual test plan;
(c) gates pass: `npm run check-types`, `npm run lint`, `npm run test:run` exit 0;
(d) git log shows >=1 commit since base SHA <P4_BASE_SHA> matching `feat(517-p4):`.
If end-to-end verification needs a running dev environment that is unavailable, record the
manual test plan and note it — that alone satisfies (b). Constraints: edit only
turbo-repo/apps/app/src/** and docs/**; <=5 files per commit. Stop after 25 turns.
```

---

## Sequencing

```
P0 → P1 → P2 → [P3 gated on ecm-coordinator#262] → P4 → Termination
```

**Termination** (after P4 `done`): `/review` the branch diff, open the
PR for #517, `PushNotification` the link.

**Expected escalation at P3.** The companion issue ecm-coordinator#262
must be merged before P3 can run. A goal-loop run started now will climb
P0 → P1 → P2 and then stop with `STATUS: BLOCKED` at P3 — resume P3→P4
once #262 lands. (P0's spike doc defines #262's exact contract.)

**Mode**: `/loop`-orchestrated, per the `goal-loop` skill's cross-rung
contract — each rung a `claude --dangerously-skip-permissions -p
"<condition>"` subprocess with cwd the modulariot worktree root.
