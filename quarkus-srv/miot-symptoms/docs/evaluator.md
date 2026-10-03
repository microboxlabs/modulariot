# Symptom evaluator

Runs published symptom versions on a vehicle's signals and keeps one episode per vehicle and symptom. It turns each signal into at most one case change per symptom: opened, level raised or closed.

**Status: core only.** Nothing feeds it signals yet and nothing stores its episodes outside memory. The signal topic, the consumer and the database store come next.

| | |
|---|---|
| Code | `quarkus-srv/miot-symptoms`, package `evaluator` |
| Input | Tenant, vehicle id, signal time, the source object (for `gps_signal`, the map under `signal`), the compiled versions |
| Output | `Transition`s (`OPENED`, `LEVEL_CHANGED`, `CLOSED`) with version, state, level and measure; `RuleError`s for rules that failed |
| State | `Episode` per tenant, vehicle and symptom, through `EpisodeStore` |

## How a signal is read

| Step | Rule |
|---|---|
| Candidate | The version's activation is true |
| Measure | The measure expression; 0 when the version has none |
| Hold time | `sostenido_s` is how long the measure has met a level's threshold, counted from the first signal where that level's rule would hold given enough time |
| Level | The highest level whose rule holds. While a level waits for its hold time, the case is at the applying level below it |
| Condition | Holds while a candidate reaches a level. `caso.condicion_s` counts from its first signal, `caso.normal_s` from the first signal after it stopped |
| Open | No case open, the condition holds and the lifecycle's open rule is true |
| Level change | A case's level only rises |
| Close | The lifecycle's close rule is true. If the condition still holds, the next signal starts a new run |

`caso.edad_h` is the time since the case opened, in hours; `caso.nivel` its level. `caso.cerrado_por_operador` is false: operators close cases through the treatment API, not through signals.

## Order and failures

- A signal not newer than the last one seen for that vehicle and symptom is ignored.
- An episode with no run, no level waiting and no open case is not kept, so a quiet vehicle costs no storage.
- A rule that fails on a signal (a missing field, a measure that is not a number) is reported as a `RuleError` for that symptom; its episode stays as it was and the other symptoms still run.
- OFF versions are not compiled. TEST transitions are for shadow counts; ACTIVE ones create cases.
