# Speed evals

Tests in `com.microboxlabs.miot.symptoms.evaluator.evals` run `SignalEvaluator` on these files.

| File | What |
|---|---|
| `production-rule.json` | The legacy SQL speed rule (OSM road limit) written as a spec |
| `production-traces.json` | 59 real trips: signals and the transitions the legacy engine produced from them |
| `known-gaps.json` | Trips the evaluator cannot match yet: the reason, and the evaluator's current transitions |

## The production rule

| Step | Rule |
|---|---|
| Over | Speed rounded to an integer, greater than the road limit |
| Opens | Over for at least 1 min, at least one signal per minute, current excess at least 5 km/h |
| Level | Current excess: over 21 → 4, from 11 → 3, from 5 → 2, else 1. Level 4 needs 1 min over 21 since the case opened; until then 3. Each change is a transition. |
| Closes | First signal not over. At level 4, after 120 s not over. |

## How the traces were made

From one day of a carrier fleet's trips (one trace per vehicle and trip), after the GPS gate that drops signals older than the last accepted one or implying more than 150 km/h. A model of the legacy rule was run on each trace, and a trace was kept only when the model reproduced the legacy engine's recorded episodes and cases exactly. Trips with custom speed limits were left out.

Each signal is `[seconds from the first signal, speed km/h, road limit or -1]`, the fields named in `columns`; `constants` holds what every signal shares. Each expected transition is `[kind, seconds, level, previous level]`. The tests write transitions as `KIND@seconds:previous>level`. The files have no plates, coordinates, ids or dates.

## Known gaps

Behaviours a spec cannot express. `SpeedRuleCasesTest` pins the first four with a `gap…` case. The last cannot be pinned: the source has no trip id. `known-gaps.json` lists the real trips they affect; `SpeedParityEvalTest` fails if one of them starts matching production or its result changes.

| Gap | Production | Evaluator |
|---|---|---|
| Sparse signals | No case with fewer signals than minutes over | Opens on time over alone |
| Code black clock | Counts from the case opening | Counts from the first signal over 21 |
| Dip at code black | A dip shorter than 90 s keeps level 4 | A signal not over restarts the hold |
| Trip ends | Closes at once | Waits for the close rule |
| New trip while over | New episode | Same case (the source has no trip id) |
