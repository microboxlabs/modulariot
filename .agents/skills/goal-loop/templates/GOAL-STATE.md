# Goal State — current rung

## STATUS: NOT STARTED

The ladder has not been climbed yet. Human must approve `GOAL-LADDER.md`
and start, in one of the two modes:

- **Human-paced**: paste rung R0's `/goal` block from `GOAL-LADDER.md`.
- **Orchestrated**:
  > /loop drive the goal ladder per <plan-dir>/GOAL-LOOP.md — read
  > GOAL-LADDER.md, run the first todo rung as `claude -p "/goal …"`,
  > follow the cross-rung contract, ScheduleWakeup the next tick. Stop
  > (omit ScheduleWakeup) on any escalation or when all rungs are done.

## Pre-flight checklist (human, before starting)

- [ ] On a feature branch (NOT main/trunk).
- [ ] `git status` clean (aside from expected untracked plan files).
- [ ] `/guard` active if the project is sensitive.
- [ ] Reviewed and approved every rung condition in `GOAL-LADDER.md`.

## Active rung

- **Rung**: (none)
- **Base SHA**: (set on rung start — `git rev-parse HEAD`)
- **`/goal` turns used / limit**: —
- **Last evaluator reason**: —

## History

| Rung | Result | End SHA | Notes |
|------|--------|---------|-------|
| —    | —      | —       | —     |

## Escalations

(none)

<!-- Overwritten each rung: active rung, base SHA, evaluator reason,
     commits, and — on a blocker — STATUS: BLOCKED + reason + next step. -->
