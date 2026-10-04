# Night stop outside an authorized zone: evals

Tests in `com.microboxlabs.miot.symptoms.evaluator.evals` run `SignalEvaluator` on these files.

| File | What |
|---|---|
| `production-rule.json` | The legacy SQL rule written as a spec |
| `production-traces.json` | 30 real trips: signals and the transitions the legacy engine produced from them |
| `known-gaps.json` | Trips the evaluator cannot match yet: the reason, and the evaluator's current transitions |

## The production rule

| Step | Rule |
|---|---|
| Matches | On a trip with one driver, stopped (under 2.78 m/s between accepted signals), local time from 21:00:00 to 05:59:59, outside every authorized zone |
| Opens | At the first matching signal, level 1 |
| Level | Minutes since it started: 10 → 2, 20 → 3, 30 → 4 |
| Closes | First signal that does not match |
| Operator | When an operator's treatment of the case expires, the case closes and the rule stays off for the rest of the trip |

"Outside every authorized zone" means: in no zone, or in at least one zone that is not authorized, even when another zone around the point is authorized. The source's `signal.geo.authorized_zone` must be computed that way to match.

## How the traces were made

From one day of a carrier fleet's trips (one trace per vehicle and trip), after the GPS gate. A model of the legacy rule was run on each trip, and a trace was kept only when it reproduced the legacy engine's recorded episodes and case levels exactly and had at least one matching signal. Of each run of non-matching signals only the first is kept: it closes the case, and the rest cannot change the result.

Columns: `[seconds, moving, local hour, inside an authorized zone]`; the trip's `double_driver` is a per-trace constant. `operatorClosedAt` is when an operator's treatment expired (seconds; negative when before the trace). The files have no plates, coordinates, ids or dates.

## Known gaps

| Gap | Production | Evaluator |
|---|---|---|
| Operator closes | Closes the case when the treatment expires; no more cases on the trip | Gets no operator events; keeps the case and opens new ones |

`NightStopRuleCasesTest` pins it with a `gap…` case; `known-gaps.json` lists the 14 trips it affects.
