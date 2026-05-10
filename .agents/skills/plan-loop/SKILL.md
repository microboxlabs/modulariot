---
name: plan-loop
description: >
  Drive a long, multi-task plan to completion via `/loop` + `ScheduleWakeup` +
  `Monitor` — a Ralph-style autonomous workflow that does NOT require the
  ralph-loop plugin. Use when the user wants to "drive a plan", "run a
  worklist autonomously", "iterate through phased tasks", "ralph-style
  loop", "long autonomous plan", or hands you a multi-phase brief that
  will take several hours and dozens of small commits to complete.
  Bootstraps a plan directory if none exists. Otherwise resumes from
  `RALPH-WORKLIST.md`.
---

# Plan Loop

Drives a phased, worklist-based plan to completion across many iterations,
using only built-in primitives (`/loop`, `ScheduleWakeup`, `Monitor`).
Replaces the `ralph-loop` plugin pattern with one that fits this repo's
conventions: every iteration produces at most one commit, every iteration
is restartable from disk, every escalation surfaces to the human instead
of being papered over.

## When to use

Trigger when the user asks for any of:

- "drive the plan", "run the worklist", "iterate the tasks"
- "ralph this", "ralph-style loop", "autonomous loop"
- "run T01–TN", "execute the deploy plan", "execute the migration plan"
- A multi-phase brief that will take >30 minutes of execution

Skip if:

- The task is one-shot (write a single file, fix a single bug). Use
  the regular agent flow.
- The work is exploratory ("explore X", "research Y"). Use plain
  conversation.
- A `/loop` invocation is already running this skill — don't
  re-enter; just continue the iteration.

## Two paths

### Path A — Plan exists at `.cursor/plans/<some-path>/`

Look for `RALPH-WORKLIST.md` first. If found, jump to **Per-iteration
contract** below.

### Path B — No plan; user just stated a goal

Bootstrap before iterating. See **Bootstrapping a new plan**.

## Bootstrapping a new plan

Create `.cursor/plans/<topic>/` with these files. **`.cursor/plans/` is
gitignored** in this repo by design — plans are scratchpads, code is the
deliverable. The git log + any committed docs are the durable record.

### File set

```
.cursor/plans/<topic>/
├── 00-overview.md            ← goal, in/out of scope, success criteria
├── 01-…md … NN-…md           ← topic-specific plan docs
├── RALPH-LOOP.md             ← rules / contract / skills / escalations
├── RALPH-WORKLIST.md         ← ordered tasks, status per task
└── RALPH-STATE.md            ← per-iteration scratchpad
```

For a working reference, see `.cursor/plans/ai-first/13-server-deployment/`
in this repo (if present locally) — it's the canonical example. The
deploy work driven by this skill produced 12 atomic commits over 14
iterations with one fix-up; that PR shape is the target.

### `RALPH-LOOP.md` template (drop into the new plan dir)

Author it with these sections, customizing each to the topic:

1. **Goal** — one paragraph, end-state in plain language.
2. **Architecture (single-file state, git is the audit log)** —
   document `RALPH-WORKLIST.md` (source of truth for "what's next"),
   `RALPH-STATE.md` (per-iteration scratchpad, overwritten),
   `git log` (immutable audit, every commit prefixed `<scope>(T<id>):`).
3. **Per-iteration contract** — exactly the steps in the next section
   of this skill, copied verbatim. Don't reword; the contract is
   load-bearing.
4. **Hard rules** — adapt per project (which paths Claude can edit,
   gates that must pass, secret-leak guards, no force-push).
5. **Escalation triggers** — copy from this skill's "Escalation"
   section.
6. **Skills to use** (the "superpowers") — a table mapping phase →
   built-in skill (`/codex consult`, `/codex challenge`, `/simplify`,
   `/investigate`, `/review`, `/ship`, `/guard`).
7. **Loop pacing** — note the cache-aware delays this skill prescribes.

### `RALPH-WORKLIST.md` template

```markdown
# <Topic> Worklist

> Source of truth for what's next. Loop reads top-down and picks the
> first `status: todo`. **One task = one commit.** Tasks are sized so
> the diff fits within the 5-files-per-iteration cap.

## Status legend
- `todo` / `in_progress` / `blocked` / `done`

## Phase 0 — Pre-flight gate (T00)

### T00 — Pre-flight checks
- **Status**: todo
- **Goal**: Validate the loop's starting state. Verification only;
  any failure is an immediate escalation.
- Checks (project-specific): branch ≠ main/trunk, working tree clean,
  origin in sync, required tools on PATH, language gates green
  (lint/types/tests), plan files present, no untracked secrets.

## Phase A — <topic-specific>

### T01 — <one-line goal>
- **Status**: todo
- **Goal**: <2-3 lines>
- **Files (≤5)**: <list expected paths>
- **Acceptance**: <how to verify the task is done>
- **Skill hint**: <`/codex consult` if non-trivial; `/codex challenge`
  for adversarial review on critical paths; otherwise none>

… more tasks …

## Sequencing summary

```
T00 → T01 → T02 → … → TN
```

NN tasks. Estimate clock time by summing per-task expected duration.
```

### `RALPH-STATE.md` template

Initial:

```markdown
# State — current iteration

## STATUS: NOT STARTED

The loop has not been kicked off yet. Human must approve
`RALPH-WORKLIST.md` and start the loop:

> /loop drive the plan per .cursor/plans/<topic>/RALPH-LOOP.md — read
> RALPH-WORKLIST.md, pick the first todo, follow the per-iteration
> contract, then ScheduleWakeup the next tick. Stop the loop entirely
> (omit ScheduleWakeup) if any escalation trigger fires or all tasks
> are done.

## Pre-flight checklist (human, before starting)

- [ ] On a feature branch (NOT main/trunk).
- [ ] `git status` clean.
- [ ] `/guard` mode active (if applicable).
- [ ] Reviewed and approved `RALPH-WORKLIST.md` task list.

## Last iteration
(none — loop not started)
```

This file is overwritten each tick with the iteration's plan, gates,
files touched, commit, and "Next" pointer.

## Per-iteration contract

Every loop tick, in order:

1. **Read** `RALPH-WORKLIST.md`. Pick the first `todo`. If none,
   **terminate** (see Termination below).
2. **Per-tick guard**: `git status --porcelain` (allow only
   harmless untracked dirs, e.g. `.claude/worktrees/`), confirm
   branch isn't main/trunk, capture starting SHA.
3. **Plan the task** in `RALPH-STATE.md` (≤10 lines). State the
   acceptance test up front. If the task is non-trivial (has design
   choices), invoke `/codex consult` *before* writing code.
4. **Execute**: write/edit code. **Hard cap: 5 files touched per
   iteration.** If more is needed, split the task instead.
5. **Run gates** in this order, stop on first failure:
   - lint (project-specific, e.g. `ruff check`)
   - types (e.g. `mypy`)
   - tests (e.g. `pytest -q`)
   - any task-specific verification (e.g. `docker build` for T06)
6. **Self-review**: run `/simplify` on the diff. Apply only obvious
   wins; bank deeper refactors as new worklist tasks.
7. **Commit** with message format `<scope>(T<id>): <verb> <one-line>`
   and push to the feature branch.
8. **Update worklist**: mark the task `done` (or `blocked` with
   reason) by editing `RALPH-WORKLIST.md` in place.
9. **Schedule next tick**: call `ScheduleWakeup` with cache-aware
   `delaySeconds` (see Pacing below) and the same `/loop` prompt.
10. **Stop iteration.** Do not start the next task in the same tick —
    the next tick re-reads state from disk.

## Escalation triggers

Surface to the human and stop. Do **not** "decide and proceed."

- Genuine architecture choice not pre-decided in the plan files.
- A test fails on `trunk`/`main` (not just on the WIP branch) —
  points to a pre-existing issue.
- A gate command behaves differently than documented.
- Need to introduce a new dependency.
- Discover a security finding (leaked secret, vulnerable dep).
- A contradiction between two plan files.
- A build/test takes >5 minutes — investigate before continuing.

When stopping for escalation:

- Write `STATUS: BLOCKED` in `RALPH-STATE.md` with reason +
  recommended next step.
- Do NOT call `ScheduleWakeup`.
- Send a `PushNotification` summarizing the block (one line, < 200 chars).

## Skills to use (the "superpowers")

Route to specialists at the right phase. **Do not call them inline
unless the contract phase calls for them** — they cost cache.

| Phase | Skill | When |
|---|---|---|
| Plan a non-trivial task | `/codex consult` | Before writing any code if the task has > 1 reasonable approach |
| Implement | (direct Edit/Write) | Always |
| Pre-commit review of diff | `/simplify` | After every code change, before commit |
| Adversarial review on critical paths | `/codex challenge` | Dockerfile, workflow YAML, anything that runs in CI silently |
| Debug a gate failure | `/investigate` | When a gate fails for unexpected reason — never just "fix and rerun" |
| Pre-PR review | `/review` | Once worklist is fully `done`, before opening the PR for human review |
| Open the PR | `/ship` | At the end — *not* before all tasks are done |
| Safety mode | `/guard` | Active for the entire loop run, if the project is sensitive |

Skills the loop must NOT call: `/land-and-deploy`, `/canary`, anything
that pushes to prod or merges. Image promotion / merge / deploy is
human work.

## Loop pacing (cache-aware `delaySeconds`)

The Anthropic prompt cache has a 5-minute TTL. Picking `delaySeconds`
right keeps cache hot AND keeps the loop responsive.

| Task type | `delaySeconds` | Reason |
|---|---|---|
| Quick code task (≤ 1 min wall clock) | **60** | In-cache continuation |
| Container build / image rebuild | **270** | Stay just under cache window during a 1–3 min build |
| Test suite that takes 1–3 min | **270** | Same |
| CI run on a feature branch | **1500** (with `Monitor`) | Sleep through; Monitor wakes on events |
| Idle waiting on external review | **1500–1800** | Don't burn cache on idle |

**Never use 300–1199** — that's the worst-of-both: pay the cache
miss without amortizing it. If tempted to "wait 5 minutes", drop to
270 or commit to 1500+.

## Monitor: event-driven wakes (CI, log lines, file changes)

Use `Monitor` when the next iteration is gated on an external event,
not a passage of time. Examples: CI run completing, a PR comment
arriving, a deploy log line landing.

```
prev=""
while true; do
  s=$(gh pr checks <pr-num> -R <owner>/<repo> --json name,bucket 2>/dev/null || true)
  if [[ -n "$s" ]]; then
    cur=$(jq -r '.[] | select(.bucket!="pending") | "\(.name): \(.bucket)"' <<<"$s" | sort)
    comm -13 <(echo "$prev") <(echo "$cur")
    prev=$cur
    if jq -e 'length > 0 and all(.bucket!="pending")' <<<"$s" >/dev/null; then
      echo "ALL_CHECKS_DONE"; break
    fi
  fi
  sleep 30
done
```

Pair with `ScheduleWakeup(delaySeconds=1500, …)` as a safety net in
case the Monitor stalls. Stop monitors with `TaskStop` if you exit
early; otherwise they self-exit on `break`.

## Termination

When `RALPH-WORKLIST.md` has zero `todo` items:

1. **Mark the PR ready** if it was opened as draft (`gh pr ready
   <num>`) — typically done as part of the final task (e.g. T11 in
   our deploy plan).
2. **Send a `PushNotification`** with the outcome: one line,
   < 200 chars, links to the PR.
3. **Omit `ScheduleWakeup`** — the loop terminates naturally when no
   wake is scheduled.
4. **`TaskStop`** any monitors still running.

When the worklist has a `blocked` item:

1. Write `STATUS: BLOCKED` to `RALPH-STATE.md` with the reason +
   recommended next step.
2. `PushNotification` the block (so the human sees it even if they're
   away).
3. Omit `ScheduleWakeup`. Stop monitors.

## Per-project gate detection

Different projects, different gates. Sniff before assuming.

| Signal | Project type | Gates |
|---|---|---|
| `pyproject.toml` + `uv.lock` | Python with uv | `uv run ruff check`, `uv run mypy`, `uv run pytest -q` |
| `pyproject.toml` only | Python with pip/poetry | adapt to the tool |
| `package.json` + `pnpm-lock.yaml` | pnpm | `pnpm lint && pnpm typecheck && pnpm test` |
| `package.json` + `package-lock.json` | npm | `npm run lint && npm run typecheck && npm test` |
| `pom.xml` | Maven | `mvn verify -DskipITs` |
| `Cargo.toml` | Rust | `cargo clippy && cargo test` |
| `go.mod` | Go | `go vet ./... && go test ./...` |

If the project has a custom test harness (CI workflow, Makefile,
`scripts/check.sh`), prefer that — it's the project's contract.

## What this skill replaces

- The `ralph-loop` plugin (auto-fire-prompt-without-ScheduleWakeup) —
  not needed; `/loop` + `ScheduleWakeup` covers the same use case
  more flexibly and integrates with `Monitor` for event-driven wakes.
- Ad-hoc "I'll just iterate manually" — gives you the per-iteration
  contract, escalation discipline, and cache-aware pacing for free.

## Quick start cheat sheet

```
# 1. (If no plan exists) bootstrap one
mkdir -p .cursor/plans/<topic>/
# author 00-overview.md, RALPH-LOOP.md, RALPH-WORKLIST.md, RALPH-STATE.md
# (use templates in this skill)

# 2. Pre-flight (human, once)
git switch -c <topic-loop>           # feature branch
# verify gates green on starting SHA

# 3. Start the loop
/loop drive the plan per .cursor/plans/<topic>/RALPH-LOOP.md — \
  read RALPH-WORKLIST.md, pick the first todo, follow the per-iteration \
  contract, then ScheduleWakeup the next tick. Stop the loop entirely \
  (omit ScheduleWakeup) if any escalation trigger fires or all tasks \
  are done.

# 4. Walk away. Come back to a PR or a STATUS: BLOCKED.
```
