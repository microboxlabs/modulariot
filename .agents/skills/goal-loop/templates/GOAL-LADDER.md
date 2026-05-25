# <Objective> — Goal Ladder

> Source of truth for what's next. Each rung is one phase = one `/goal`
> condition = one session. Climb top-down; the first rung not `done` is
> the active one. See `GOAL-LOOP.md` for the contract.

## Status legend
- `todo` / `in_progress` / `blocked` / `done`

## Rung index
| Rung | Phase | Status |
|------|-------|--------|
| R0   | <phase 0 name> | todo |
| R1   | <phase 1 name> | todo |
| …    | …     | todo |

---

## R0 — <phase 0 name>

- **Status**: todo
- **Base SHA**: (recorded in GOAL-STATE.md when the rung starts)

```
/goal Follow <plan-doc> §Phase 0 and the contract in <plan-dir>/GOAL-LOOP.md.
On branch <branch>, rung R0 is achieved when ALL hold:
(a) <deliverable, concretely stated>;
(b) <verification: command + expected exit, or file check>;
(c) <gate: e.g. build/compile command exits 0>;
(d) git log shows >=1 commit since the base SHA in GOAL-STATE.md matching `feat(<id>-p0):`.
Constraints: <paths not to touch>; <=5 files per commit; no secrets.
Stop after <N> turns if not achieved.
```

## R1 — <phase 1 name>

- **Status**: todo
- **Base SHA**: —

```
/goal … rung R1 achieved when ALL hold: … matching `feat(<id>-p1):`. Stop after <N> turns.
```

… more rungs …

---

## Sequencing

```
R0 → R1 → … → RN → Termination (review + PR)
```

Mode: <human-paced | /loop-orchestrated>. NN rungs.
