---
name: goal-loop
description: >
  Drive a long, multi-stage objective to completion with the Claude Code
  `/goal` plugin — a Ralph-style autonomous workflow built on `/goal`'s
  single-condition evaluator loop instead of `/loop`+ScheduleWakeup. Use
  when the user wants to "drive a goal", "goal ladder", "ralph with
  /goal", "run the goal loop", "autonomous goal", or hands you a
  multi-phase brief to be executed via `/goal`. Bootstraps a goal ladder
  if none exists; otherwise resumes from `GOAL-LADDER.md`. For the
  ScheduleWakeup-based variant, use `plan-loop` instead.
---

# Goal Loop

Drives a phased objective to completion with the **`/goal`** plugin.
`/goal` is a single-condition autonomous loop — it has no stages, no
sub-tasks, no pacing. This skill layers multi-stage Ralph discipline on
top of it: a **Goal Ladder** climbed one rung at a time, each rung a
self-contained `/goal` condition, the ladder itself on disk.

## `/goal` — the primitive (read first)

Everything here is shaped by what `/goal` actually is:

- `/goal <condition>` sets **one** goal — a measurable end-state,
  ≤4000 chars. `/goal` shows status; `/goal clear` clears.
- After every turn a fast model (Haiku) reads the transcript and
  answers yes/no on the condition. "No" → its reason becomes guidance,
  another turn fires. "Yes" → the goal auto-clears, marked achieved.
- **One goal per session.** No sub-tasks, no milestones, no pacing
  control, no ScheduleWakeup. The session grows turn by turn.
- State is in-session. `--resume` restores the active condition but
  resets counters; achieved/cleared goals are not restored. The plugin
  writes no repo files.

Consequences this skill is built around:
1. Multi-stage ⇒ a **ladder of goals**, one rung per phase.
2. "What's next" must live **on disk** — `/goal` has no memory of it.
3. The evaluator only sees the transcript ⇒ every rung condition must
   embed its own **machine-checkable verification**.
4. The evaluator is binary ⇒ escalation degrades to a turn-limit
   backstop unless an outer `/loop` orchestrates (see Sequencing).

## When to use

Trigger when the user asks to "drive a goal", "goal ladder", "ralph
with /goal", "run the goal loop", or hands you a multi-phase brief to
run via `/goal`.

Skip if:
- One-shot work — just do it.
- The user wants ScheduleWakeup-paced discrete ticks → use `plan-loop`.
- A rung's `/goal` is already running — don't re-enter; let it iterate.

## Two paths

### Path A — Ladder exists (`GOAL-LADDER.md` present)

Jump to **Climbing the ladder**.

### Path B — No ladder; user stated an objective

Bootstrap one. See **Bootstrapping a ladder**.

## File set

```
<plan-dir>/
├── GOAL-LADDER.md   ← ordered rungs; each rung = a ready-to-paste
│                       /goal condition + status. Source of truth.
├── GOAL-LOOP.md     ← contract / hard rules / escalation / skills
├── GOAL-STATE.md    ← active rung, base SHA, history, escalations
└── git log          ← immutable audit (commits prefixed per rung)
```

Templates live in `templates/` next to this skill. Put the dir wherever
the project keeps plans (e.g. `docs/plans/` if committed, or a
gitignored scratch dir). The rung conditions are durable, useful
documentation — prefer committing the ladder.

## Bootstrapping a ladder

1. Break the objective into **phases** — each phase is one rung, sized
   so its `/goal` finishes in one focused session (tens of turns, a
   handful of commits).
2. For each phase author a **rung condition** (see next section).
3. Write `GOAL-LADDER.md` (rungs, all `status: todo`), `GOAL-LOOP.md`
   (contract), `GOAL-STATE.md` (`STATUS: NOT STARTED`).
4. Surface the ladder to the human for approval **before** climbing.

## Authoring a rung condition — the make-or-break detail

The Haiku evaluator only sees the transcript. A rung condition that
says "Phase 1 is done" is unverifiable and the loop never terminates.
Every rung condition MUST contain:

- **Branch + plan reference** — where work happens, what spec to follow.
- **An explicit acceptance list** — `ALL hold: (a) … (b) …`, each
  clause objectively checkable.
- **Embedded verification** — a command + expected exit, a file
  existence/content check, or a `git log` message match. Quote them so
  the evaluator can confirm them from the transcript.
- **Constraints** — paths Claude must not touch, gates that must stay
  green, "no secrets", "≤5 files per commit".
- **A turn limit** — `Stop after N turns if not achieved.` This is the
  escalation backstop.

Keep it under 4000 chars; ~600–1200 is typical. Anchor completion to a
`git log` match (`feat(<id>-pN):`) so "is the rung done" is a one-liner
the evaluator can trust.

## Climbing the ladder

**One phase = one rung = one `/goal` = one session.** Running each rung
in its own session keeps context fresh and restartable — the Ralph
property. The ladder on disk sequences them.

### Per-rung contract (inside a rung's `/goal` run)

1. **Turn 1** — read `GOAL-LOOP.md` + `GOAL-STATE.md`; record the rung
   **base SHA** (`git rev-parse HEAD`) in `GOAL-STATE.md`; restate the
   acceptance list.
2. **Guard** — branch ≠ main/trunk, working tree sane.
3. **Implement** toward the condition. ≤5 files per commit.
4. **Gates** after each change — lint / compile / types / tests, stop
   on first failure (see `GOAL-LOOP.md` for the project's commands).
5. **Self-review** — `/simplify` the diff before each commit.
6. **Commit** `feat(<id>-pN): <verb> <one-line>` and push.
7. When every acceptance clause holds, write the rung result to
   `GOAL-STATE.md`. The evaluator catches the "Yes" and auto-clears.
8. **Blocker** — on a genuine escalation trigger, write
   `STATUS: BLOCKED` + reason to `GOAL-STATE.md` and stop changing
   code; the turn limit ends the goal unachieved.

### Sequencing — two modes

| Mode | Rung advance | Escalation | Operator |
|---|---|---|---|
| **Human-paced** | Human runs `/goal <rung>` per phase, reviews the commit, runs the next | Turn-limit + `BLOCKED` marker; human must watch | Babysits between rungs |
| **`/loop`-orchestrated** | An outer `/loop` reads `GOAL-LADDER.md`, runs each rung as `claude -p "/goal <rung>"`, detects achieve/block, advances | Restored — outer loop sees `BLOCKED`/turn-limit, `PushNotification`s, stops | Walks away |

The orchestrated mode is the true "Ralph across stages": **`/loop` +
`ScheduleWakeup` sequence the rungs; `/goal` is the rung engine**, each
rung in its own `claude -p` subprocess. The orchestrating session uses
`/loop` and **must not** itself call `/goal` — one goal per session.

### Cross-rung contract (orchestrated mode, per `/loop` tick)

1. Read `GOAL-LADDER.md`; pick the first rung not `done`. None → go to
   **Termination**.
2. Inspect the active rung:
   - **Not started** → record base SHA in `GOAL-STATE.md`, launch
     `claude -p "/goal <rung condition>"` as a background task,
     `ScheduleWakeup(1500)`.
   - **Running** → `ScheduleWakeup(1500)`, stop.
   - **Exited** → verify: gates green + a `feat(<id>-pN):` commit
     since base SHA ⇒ mark rung `done`, `ScheduleWakeup(60)` to pick
     the next. Turn-limit hit or `STATUS: BLOCKED` ⇒ **escalate**.
3. Stop the iteration — next tick re-reads disk.

## Escalation triggers

Surface and stop — do not "decide and proceed":

- A genuine architecture choice not pre-decided in the plan.
- A gate fails on `trunk`/`main` (pre-existing breakage).
- A rung needs a new dependency, or a running environment it can't get.
- A security finding (leaked secret, vulnerable dep).
- A contradiction between plan files, or a gate behaving off-spec.
- A rung hits its turn limit unachieved.

On escalation: `STATUS: BLOCKED` + reason + recommended next step in
`GOAL-STATE.md`; in orchestrated mode `PushNotification` (one line,
<200 chars) and omit `ScheduleWakeup`; do not `/goal clear`.

## Restartability

`/goal` state is in-session and fragile. `GOAL-LADDER.md` +
`GOAL-STATE.md` on disk are the durable source of truth — a rung is
always re-derivable from them. If a rung session dies, re-run its
`/goal` from `GOAL-LADDER.md`; the per-rung contract's base-SHA +
idempotent gates make a partial rung safe to resume.

## Skills to use

| Phase | Skill | When |
|---|---|---|
| Plan a non-trivial rung | `/codex consult` | Before code if >1 reasonable approach |
| Pre-commit review | `/simplify` | After every change, before commit |
| Adversarial review | `/codex challenge` | CI/build/critical paths |
| Debug a gate failure | `/investigate` | Never "fix and rerun" blindly |
| Pre-PR review | `/review` | After the last rung, before the PR |
| Open the PR | `/ship` | Termination only |
| Safety | `/guard` | Whole run, if the project is sensitive |

Never call `/land-and-deploy`, `/canary`, or anything that merges or
deploys — that is human work.

## Termination

When every rung is `done`:
1. `/review` the full branch diff.
2. `/ship` — open the PR (draft → ready as appropriate).
3. `PushNotification` the outcome with the PR link (<200 chars).
4. Orchestrated mode: omit `ScheduleWakeup`; `TaskStop` any monitors.

When a rung is `blocked`: `STATUS: BLOCKED` in `GOAL-STATE.md`,
`PushNotification`, stop. No PR.

## Quick start

```
# 1. Bootstrap (if no ladder): author GOAL-LADDER.md / GOAL-LOOP.md /
#    GOAL-STATE.md from templates/. Get human approval.

# 2. Climb — human-paced:
/goal <paste rung R0 condition from GOAL-LADDER.md>
#    …review the commit, then paste R1, etc.

# 2'. Climb — orchestrated:
/loop drive the goal ladder per <plan-dir>/GOAL-LOOP.md — read
  GOAL-LADDER.md, run the first todo rung as `claude -p "/goal …"`,
  follow the cross-rung contract, ScheduleWakeup the next tick. Stop
  (omit ScheduleWakeup) on any escalation or when all rungs are done.
```
