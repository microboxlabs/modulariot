# Speeding over the organization's own limit: evals

| File | What |
|---|---|
| `production-rule.json` | The legacy SQL rule written as a spec |
| `production-traces.json` | 18 real trips and the transitions the legacy engine produced |
| `known-gaps.json` | None: every trip matches |

## The production rule

The same as the road-limit rule (`../speed`) with the organization's limit for the road segment, and different timing:

| Step | Road limit | Own limit |
|---|---|---|
| Opens | After 1 min over, at least one signal per minute, and 5 km/h over | After 9 s over and 5 km/h over |
| Code black | 1 min over 21 since the case opened; a pause over 90 s restarts the clock | 6 s over 21 since the case opened; no restart |

Where a segment has its own limit, the road limit is not checked.

## Limits

Each signal's own limit comes from the legacy speed-limit function, run on the signal with the previous accepted position. The segment order and direction the legacy pipeline keeps between signals were not replayed; the function reads them only when two positions are the same. Trips where that made a difference were dropped by the check below.

## How the traces were made

As in `../speed`: one day of a carrier fleet's trips, after the GPS gate, kept where a model of the legacy rule reproduced the engine's episodes and case levels exactly. Of each trip only the signals that can change the result are kept: every signal over the limit and the 150 s after it. Columns: `[seconds, speed km/h, own limit or -1]`. No plates, coordinates, ids or dates.

None of the 18 trips reaches code black. `SpeedCustomRuleCasesTest` covers it, and pins two gaps:

| Gap | Production | Evaluator |
|---|---|---|
| Code black clock | Counts from the case opening | Counts from the first signal over 21 |
| Dip at code black | Keeps level 4 through any pause | A signal not over restarts the hold |
