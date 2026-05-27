# <Objective> — Goal Loop contract

Customize each section to the project, then keep it stable — the
contract is load-bearing and every rung condition references it.

## 1. Goal

One paragraph: the end-state in plain language, and why a ladder of
`/goal` rungs rather than one mega-goal.

## 2. Architecture

- `GOAL-LADDER.md` — ordered rungs, source of truth for "what's next".
- `GOAL-STATE.md` — per-rung scratchpad (active rung, base SHA,
  evaluator reason, escalations); overwritten each rung.
- `git log` — immutable audit; every commit prefixed `feat(<id>-pN):`.
- `/goal` runs one rung per session; the ladder sequences rungs.

## 3. Per-rung contract

Copy the "Per-rung contract" steps from the `goal-loop` skill verbatim.
Do not reword — it is load-bearing.

## 4. Cross-rung contract (orchestrated mode only)

Copy the "Cross-rung contract" steps from the `goal-loop` skill verbatim.
The orchestrating `/loop` session must never call `/goal` itself.

## 5. Gates (sniff the project; stop on first failure)

List the exact commands — lint, compile, types, tests. Rungs reference
these. Example (Maven): `mvn -q -DskipTests package`, `mvn -q test`.

## 6. Hard rules

- Editable paths / forbidden paths.
- ≤5 files per commit; one logical change per commit.
- No secrets, no real credentials/UUIDs in committed config.
- No force-push; no merge/deploy (human work).

## 7. Escalation triggers

Copy from the `goal-loop` skill's "Escalation triggers". On a blocker:
`STATUS: BLOCKED` in `GOAL-STATE.md`; orchestrated mode `PushNotification`
and omit `ScheduleWakeup`.

## 8. Skills

Map phase → skill: `/codex consult` (plan), `/simplify` (pre-commit),
`/codex challenge` (critical paths), `/investigate` (gate failures),
`/review` + `/ship` (termination), `/guard` (whole run).

## 9. Loop pacing (orchestrated mode)

`ScheduleWakeup` cache-aware delays: **1500** while a rung's `claude -p`
subprocess runs (idle wait), **60** to pick up the next rung once one
is done. Never 300–1199.
