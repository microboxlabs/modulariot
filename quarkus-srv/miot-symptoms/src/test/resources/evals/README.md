# Symptom evals

Each folder holds one production symptom: the legacy SQL rule written as a spec, real trips with the transitions the legacy engine produced, and the trips the evaluator cannot match yet. Tests in `com.microboxlabs.miot.symptoms.evaluator.evals` replay them through `SignalEvaluator`. `ParityCheck` fails when a trip stops matching, or when a known gap starts matching.

The traces come from one day of a carrier fleet's trips. A trip was kept only when a model of the legacy rule reproduced the engine's recorded episodes and cases exactly. The files have no plates, coordinates, ids or dates.

## Coverage

| Symptom | Folder | Trips | Identical | Known gaps |
|---|---|---|---|---|
| Speeding over the road limit | `speed` | 59 | 52 | Code black clock starts at the case; sparse signals |
| Speeding over the organization's limit | `speed-custom` | 18 | 18 | Code black clock; dips at code black (rule cases) |
| Stop at night outside an authorized zone | `night-stop-unauthorized` | 30 | 16 | Operator closes |
| Stop in a risk zone | `risk-zone-stop` | 15 | 15 | — |
| Overnight stay in a risk zone | `night-risk-stay` | 6 | 6 | — |
| Driving in the early morning | `off-hours-driving` | 7 | 6 | 45-minute clock |
| Continuous driving | `continuous-driving` | 4 | 4 | — |
| Lost signal | `lost-signal` | 59 | 59 | — |
| SOS | `PanicButtonRuleCasesTest` | rule cases | — | Operator closes |

## Gaps that apply to several symptoms

| Gap | Production | Evaluator |
|---|---|---|
| Operator closes | When an operator's treatment of a case expires, a job closes it; for some rules nothing more opens on that trip | Gets no operator events |
| Trip change | Every rule's episode belongs to one trip | Cases belong to the vehicle and symptom |
| Fields the source lacks | Risk zone (geofence type), "silence unusual for the area" | Fixtures add them with `extraFields` |

## Not covered yet

| Symptom | Why |
|---|---|
| Continuous rest | Needs whole trips longer than a day, and operator treatments reset it |
| Double-driver rotation | A reminder 30 minutes after the trip starts, then 5 hours after the last operator treatment: driven by operator events |
| Fatigue, load securing, road assistance, other device events | Too few events to replay. Two legacy level formulas never reach level 4: fatigue checks `>= 300 s → 2` before the higher steps, and load securing checks `> 120 s → 3` before `>= 150 s → 4` |
