# Ralph Loop prompt for Plan 13

Copy-paste the block below into `/ralph-loop:ralph-loop` when you're ready to start. Recommended invocation:

```
/ralph-loop:ralph-loop "<paste the block below>" --max-iterations 70 --completion-promise "PLAN_13_DONE"
```

70 iterations because the checklist has 31 tasks and some need 1–2 retries plus 6 review checkpoints. Adjust after the first session.

---

## The prompt

```
You are implementing plan 13 (.cursor/plans/ai-first/13-post-nexo-roadmap.md).
Source of truth for progress: .ralph/state.md.
Source of truth for current blockers: .ralph/blockers.md.

EACH ITERATION:
1. Invoke skill: superpowers:using-superpowers
2. Read .ralph/blockers.md. If any OPEN blocker prevents the next task in document order, skip to the first task that is not blocked. If ALL remaining tasks are blocked, output "BLOCKER: <one-line>" and STOP.
3. Read .ralph/state.md. Pick the FIRST unchecked [ ] task in document order whose dependencies are met.
4. For the task type:
   - Design / contract task (A2 callback shape, E1 ModeResolver contract, E6 agentic_graph topology): invoke superpowers:writing-plans first.
   - Code task (most A*, B*, C*, E*): invoke superpowers:test-driven-development. Write a failing test, then minimal code to pass.
   - Verification task (D*, F*): invoke superpowers:verification-before-completion. Run real commands, paste output.
   - Bug encountered mid-task: invoke superpowers:systematic-debugging.
5. Implement. Keep changes scoped to the single task.
6. Run `uv run pytest` (or the targeted subset). All previously-passing tests MUST still pass.
7. If the task is complete and verified:
   - Update .ralph/state.md: change [ ] to [x], bump "Iteration", update timestamp.
   - Append to .ralph/log.md: iteration number, task ID, commit SHA, one-line summary.
   - Commit on branch feat/harness-phase-13-telemetry-agentic with message "harness(phase-13): <task ID> <short>".
8. If the task cannot be completed (genuine blocker, not a bug): write the question to .ralph/blockers.md as a new OPEN entry with task IDs it blocks, output "BLOCKER: <summary>" and STOP.
9. Check .ralph/state.md: if every box in Phase F is [x], output "PLAN_13_DONE" and STOP. Otherwise continue iterating.

NEVER:
- Skip TDD on code tasks.
- Mark a task [x] without running its verification command and confirming output.
- Modify the plan file (.cursor/plans/ai-first/13-post-nexo-roadmap.md) — that is the spec.
- Modify .cursor/plans/ai-first/{09,10,11,12}-*.md (upstream sources).
- Touch files outside miot-harness/, infra/observability/, .ralph/, scripts/, or the test tree.
- Use --no-verify on commits.
- Echo, log, or commit any secret. .env files stay gitignored.
- Push to trunk. Only commit on feat/harness-phase-13-telemetry-agentic.
- Move past E3 (composable primitives) without the safety tests green — the primitives are the highest-risk surface in this plan.

REVIEW CHECKPOINTS (invoke superpowers:requesting-code-review when these complete):
- After all of Phase A is [x] (telemetry foundation).
- After all of Phase B is [x] (backend deployed).
- After all of Phase D is [x] (telemetry verified end-to-end).
- After E3 is [x] (composable primitives + safety gate — high-risk surface).
- After all of Phase E is [x] (agentic search complete).
- Before opening the PR in F5.

COMPLETION PROMISE: PLAN_13_DONE
BLOCKER FORMAT: BLOCKER: <one-line>
```

---

## How Plan 13 differs from Plan 12

- **Two big tracks in one PR**: telemetry (A–D) + agentic search (E). Telemetry MUST be green before E starts so per-agent cost visibility exists when the agentic surface lights up.
- **Infra changes**: docker-compose stack at `infra/observability/`. Ralph touches this for the first time in plan 13.
- **Higher-risk surface**: composable DB primitives (E3) need an airtight safety gate. The review checkpoint after E3 is non-negotiable.
- **Mode-selection feature**: `RunRequest.mode` lets callers bypass the LLM router. Test the bypass paths explicitly.

## Phase-13 worktree

Path: `.claude/worktrees/harness-phase-13/`
Branch: `feat/harness-phase-13-telemetry-agentic`
Base: `trunk` at SHA `baed70e8` (Merge PR #456) as of worktree creation.
