# State — current iteration

> Overwritten each tick by the loop. Source of truth for "what is the
> loop doing right now and what did the last iteration produce."

## STATUS: NOT STARTED

The loop has not been kicked off yet. Human must approve
`RALPH-WORKLIST.md` and start the loop:

```
/loop drive the plan per .cursor/plans/<topic>/RALPH-LOOP.md — read
RALPH-WORKLIST.md, pick the first todo, follow the per-iteration
contract, then ScheduleWakeup the next tick. Stop the loop entirely
(omit ScheduleWakeup) if any escalation trigger fires or all tasks
are done.
```

## Pre-flight checklist (human, before starting)

T00 in `RALPH-WORKLIST.md` is the authoritative pre-flight — the loop
runs it as the first worklist task and stops the entire loop if any
check fails. The list below is a minimal smoke check the human can
do before kicking the loop off.

- [ ] On a feature branch (NOT main/trunk).
- [ ] `git status` clean (or only well-known untracked dirs).
- [ ] `/guard` mode active (if applicable).
- [ ] Reviewed and approved `RALPH-WORKLIST.md`.

## Last iteration

(none — loop not started)

---

## Template — the loop fills this in each tick

```
## Iteration N — <task ID>: <task name>

### Plan (≤10 lines)
…

### Acceptance test
…

### Files touched
- path/to/file.ext

### Gates
- lint: pass/fail
- types: pass/fail
- tests: pass/fail (N selected, M passed)
- task-specific: …

### Self-review notes (/simplify)
…

### Commit
- sha: <short>
- message: <scope>(T<id>): <verb> <one-line>

### Next
- Worklist updated: T<id> → done
- Next task: T<id+1>
```
