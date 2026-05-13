# <Topic> — Plan Loop Rules

> Generic loop rules shipped by the `plan-loop` skill. The
> per-iteration contract and escalation triggers below are
> load-bearing — copy verbatim. The "Project gates" and "Edit
> allowlist" sections are the only places you customize.

## Goal

(One paragraph — what's the end state? Replace this.)

## Architecture (single-file state, git is the audit log)

```
.cursor/plans/<topic>/
├── 00-overview.md … NN-…md  ← plan content (read-only to the loop)
├── RALPH-LOOP.md            ← this file
├── RALPH-WORKLIST.md        ← ordered tasks, status per task
└── RALPH-STATE.md           ← per-iteration scratchpad
```

- `RALPH-WORKLIST.md` is the source of truth for "what's next".
- `RALPH-STATE.md` is overwritten each tick.
- `git log` is the immutable audit. Every commit message starts with
  `<scope>(T<id>): <verb> <one-line>`.

## Per-iteration contract

Every loop tick, in order:

1. **Read** `RALPH-WORKLIST.md`. Pick the first `todo`. If none, terminate.
2. **Per-tick guard**: working tree clean (modulo well-known untracked
   dirs); not on `main`/`trunk`; capture starting SHA.
3. **Plan** in `RALPH-STATE.md` (≤10 lines). State the acceptance test
   up front. If the task is non-trivial, invoke `/codex consult`
   *before* writing code.
4. **Execute**: edit code. **Hard cap: 5 files touched per iteration.**
   Split if more is needed.
5. **Run gates** in this order, stop on first failure:
   - lint, types, tests (project-specific — see below)
   - any task-specific verification (e.g. `docker build`)
6. **Self-review**: `/simplify` on the diff. Apply only obvious wins.
7. **Commit** with `<scope>(T<id>): <verb> <one-line>` and push.
8. **Update worklist**: mark task `done` (or `blocked`) in
   `RALPH-WORKLIST.md`.
9. **Schedule next tick**: `ScheduleWakeup` with cache-aware
   `delaySeconds` and the same `/loop` prompt.
10. **Stop iteration.** No more work this tick.

## Hard rules (loop terminates on violation)

- **No skipped gates.** Failing tests means commit-and-stop with the
  task `blocked: tests failing`.
- **No edits outside the allowlist** (see Edit allowlist below).
- **No secrets in commits.** Pre-commit secret scan on every diff.
- **No `git push --force`, no `--no-verify`, no rebase of others'
  commits, no `git reset --hard`.**
- **No new dependencies** unless explicitly authorized by the user.
- **One commit per iteration**, max.

## Escalation triggers (stop, write state, exit)

Surface to the human and stop. Do **not** "decide and proceed."

- Genuine architecture choice not pre-decided in the plan files.
- A test fails on `trunk`/`main` (not just on the WIP branch).
- A gate command behaves differently than documented.
- Need to introduce a new dependency.
- Discovers a security finding (leaked secret, vulnerable dep).
- A contradiction between two plan files.
- A build/test takes >5 minutes — investigate before continuing.

When stopping:

```
## STATUS: BLOCKED
Reason: <one paragraph>
Recommended next step: <what the human should do>
```

Plus `PushNotification` with one-line outcome.

## Skills to use (the "superpowers")

| Phase | Skill | When |
|---|---|---|
| Plan a non-trivial task | `/codex consult` | > 1 reasonable approach |
| Implement | (direct Edit/Write) | Always |
| Pre-commit review of diff | `/simplify` | After every code change |
| Adversarial review on critical paths | `/codex challenge` | Dockerfile, workflow YAML, anything that fails silently in CI |
| Debug a gate failure | `/investigate` | Never just "fix and rerun" |
| Pre-PR review | `/review` | Once worklist is fully `done` |
| Open the PR | `/ship` | At the end only |
| Safety mode | `/guard` | Active for the entire loop run |

Do **not** call: `/land-and-deploy`, `/canary`, anything that pushes
to prod or merges. Image promotion / merge / deploy is human work.

## Loop pacing

| Task type | `delaySeconds` | Reason |
|---|---|---|
| Quick code task (≤ 1 min) | 60 | In-cache continuation |
| Container build / image rebuild | 270 | Stay under cache window |
| Test suite (1–3 min) | 270 | Same |
| CI run on a feature branch (with Monitor) | 1500 | Sleep through; Monitor wakes on events |
| Idle waiting on review | 1500–1800 | Don't burn cache on idle |

Never use 300–1199 — pays the cache miss without amortizing it.

## Project gates (CUSTOMIZE)

(Replace with the gate commands for this project.)

- **lint**: e.g. `cd <pkg> && uv run ruff check src tests`
- **types**: e.g. `cd <pkg> && uv run mypy`
- **tests**: e.g. `cd <pkg> && uv run pytest -q`

## Edit allowlist (CUSTOMIZE)

The loop must NOT edit anything outside these paths:

- `<package-or-app-dir>/`
- `.github/workflows/<workflow-file>`
- `.cursor/plans/<this-plan-dir>/RALPH-WORKLIST.md`
- `.cursor/plans/<this-plan-dir>/RALPH-STATE.md`

(Any other path = escalation.)

## How to start the loop

After human approval of `RALPH-WORKLIST.md`:

```
/loop drive the plan per .cursor/plans/<topic>/RALPH-LOOP.md — read
RALPH-WORKLIST.md, pick the first todo, follow the per-iteration
contract, then ScheduleWakeup the next tick. Stop the loop entirely
(omit ScheduleWakeup) if any escalation trigger fires or all tasks
are done.
```

## Restart contract

If the loop is interrupted (laptop closes, session ends), restarting is:

1. Read `RALPH-STATE.md` — what was the last task, did it commit?
2. Read `RALPH-WORKLIST.md` — find the first `todo` (or reset
   `in_progress` if no commit landed).
3. Resume per the contract above.

The loop is **stateless across ticks** except for the worklist file
and git. That's load-bearing — don't introduce hidden state.
