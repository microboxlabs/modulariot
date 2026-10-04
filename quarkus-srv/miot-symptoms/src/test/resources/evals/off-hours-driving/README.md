# Driving in the early morning: evals

| File | What |
|---|---|
| `production-rule.json` | The legacy SQL rule written as a spec |
| `production-traces.json` | 7 real trips and the transitions the legacy engine produced |
| `known-gaps.json` | Trips the evaluator cannot match yet: the reason, and the evaluator's current transitions |

## The production rule

| Step | Rule |
|---|---|
| Matches | On a trip with one driver, moving, local time from 01:30:01 to 05:59:59 |
| Opens | At the first matching signal |
| Level | From the local time of the latest signal: 01:30–02:00 → 1; 02:00–02:30 and 05:40–06:00 → 2; 02:30–05:40 → 3, or 4 after 45 minutes driving. The level goes down too. |
| Closes | First signal that does not match |
| Hidden | When the point is inside an authorized zone, the case is created but marked excluded |

## Known gaps

| Gap | Production | Evaluator |
|---|---|---|
| 45 minutes for level 4 | Counted from the start of the case | Counted from when level 4's clock window starts (02:30) |

`ZoneAndHourRuleCasesTest` pins it with a `gap…` case; `known-gaps.json` lists the trip it affects.

## How the traces were made

As in `night-stop-unauthorized`. Columns: `[seconds, moving, local hour]`. No plates, coordinates, ids or dates.
