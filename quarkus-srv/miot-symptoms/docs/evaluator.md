# Symptom evaluator

Runs published symptom versions on a vehicle's signals and keeps one episode per vehicle and symptom. It turns each signal into at most one case change per symptom: opened, level changed or closed.

**Status: on.** An organization without TEST or ACTIVE `gps_signal` symptoms costs one cached catalog read every 30 s and one sample write every 15 s. `EvaluatorStream` reads `tracking/asset-signals` (built by the signal builder, [gps-signal.md](gps-signal.md)) for every organization in the signal's `clients`, keeps episodes in Redis and records every case change in `miot_symptoms.signal_transitions`. An ACTIVE OPENED transition is a Control Tower case (see Cases below); TEST transitions are shadow counts.

| Setting | Meaning | Default |
|---|---|---|
| `MIOT_SYMPTOMS_EVALUATOR_ENABLED` | Consume signals | follows the signal builder |
| `MIOT_SYMPTOMS_EVALUATOR_REDIS_URL` | `redis://:password@host:6379`; unset keeps episodes in memory (one replica only) | unset |
| `MIOT_SYMPTOMS_EVALUATOR_EPISODE_TTL` | How long a vehicle's episodes live after their last write | `P7D` |

Redis holds one hash per organization and vehicle, `symptoms:ep:<tenant>:<asset>`: a field `ep:<symptom id>` per episode (JSON) and `wm:<source>` per watermark. The subscription is `Key_Shared` on `asset_id`, so one vehicle's signals are evaluated in order on one replica. A signal whose Redis, catalog or database call fails is redelivered (twice at most); the transition is written before the episode, and a replay does not write it again.

Rule previews use the organization's recent signals. At most one signal per organization every 15 s goes to the list `symptoms:samples:<tenant>` (newest 20, expires a day after the last one). The 15 s are checked in Redis (`symptoms:samples:<tenant>:gate`, in the same script as the list), so replicas share them. Only the paths of the rule editor's fields are saved: `schema`, `at`, `clients`, the frame's driver data, lists and times are dropped. An organization with no recent signals previews on the fixed samples in `symptoms/gps-signal-samples.json`.

| | |
|---|---|
| Code | `quarkus-srv/miot-symptoms`, package `evaluator` |
| Input | Tenant, vehicle id, signal time, the source object (for `gps_signal`, the map under `signal`, see [gps-signal.md](gps-signal.md)), the compiled versions |
| Output | `Transition`s (`OPENED`, `LEVEL_CHANGED`, `CLOSED`) with version, state, level and measure; `RuleError`s for rules that failed |
| State | `Episode` per tenant, vehicle and symptom, through `EpisodeStore` |

## How a signal is read

| Step | Rule |
|---|---|
| Candidate | The version's activation is true |
| Measure | The measure expression; 0 when the version has none |
| Hold time, threshold rules | A level rule that holds given enough time (`measure >= 21 && held_s >= 60`) counts `held_s` from the first signal where it would hold: how long the measure met that threshold |
| Hold time, time rules | Any other rule (`held_s >= 600 && held_s < 1200`) counts `held_s` from the start of the activation's run |
| Level | The highest level whose rule holds. If none holds while a threshold rule waits for its hold time, the case is at the applying level below it |
| Condition | Holds while a candidate reaches a level. `case.condition_s` counts from its first signal; `case.normal_s` from the first signal after it stopped, and is -1 while it holds |
| Open | No case open, the condition holds and the lifecycle's open rule is true |
| Level change | A case's level only rises, unless the lifecycle's `levelDown` lets it follow the measure down while the condition holds |
| Close | The lifecycle's close rule is true. If the condition still holds, the next signal starts a new run |

`case.age_h` is the time since the case opened, in hours; `case.level` its level. `case.closed_by_operator` is false: operators close cases through the treatment API, not through signals.

## Order, versions and failures

- Per vehicle and source, a signal not newer than the last one applied is ignored. This watermark is kept even when the episodes are not.
- A new version takes over an open case; the levels' hold times start again under its thresholds.
- An episode is kept while the activation runs, a level waits or a case is open. A vehicle off its candidate costs no storage.
- A rule that fails on a signal (a missing field, a measure that is not a number) is reported as a `RuleError` for that symptom; its episode stays as it was and the other symptoms still run.
- OFF versions are not compiled. TEST transitions are for shadow counts; ACTIVE ones create cases.

## Cases

An ACTIVE OPENED row of `signal_transitions` is a Control Tower case until a CLOSED row for the same symptom and vehicle. The Control Tower API serves them next to the GPS database's symptoms (`cases/EngineCaseService`):

| Endpoint | What changes |
|---|---|
| `GET …/control-tower/map/symptoms` | With paging only (no filters), page 1 lists the open cases first, in the GPS function's row shape, with their count in `open_cases`; the paging totals stay the GPS function's. They still show when the GPS database cannot be read |
| `GET …/map/symptoms/{id}`, `…/{id}/signals` | A negative id is a case: header from the catalog and the trip's `trip_live` row while it runs, and the signal's point as an EWKB feature |
| `POST …/treatments/{id}/close` | Closing the treatment of a case closes the case (CLOSED row with `closed_by`) and drops its Redis episode, so the next signal that meets the condition opens a new case |

A case's symptom id is the OPENED row's id negated, so it never meets a GPS database symptom id in `treatment` and `audit_event`. The row keeps the signal's trip, position and speed (V0.8.5).

## Case events

Each new transition, and an operator's close, is published in-process as an `OperationalEvent` (`miot-core`, `core.event`) with `Event.fireAsync` (`events/SymptomEvents`). A replayed signal publishes nothing again: the log returns only the rows it inserted.

| Type | When |
|---|---|
| `symptom.case.opened` | OPENED transition |
| `symptom.case.level_changed` | LEVEL_CHANGED transition |
| `symptom.case.closed` | CLOSED transition, or `POST …/treatments/{id}/close` (`closedBy` set) |
| `symptom.case.sla_expired` | The SLA timer, see below |

`source` is `miot-symptoms`, `context` is `{kind: "symptom_case", key: "<symptom id>"}` (the negated OPENED id), `data` is `SymptomCaseData`. TEST symptoms publish with `test: true`. `SymptomEventCatalog` lists the types and the payload class.

The SLA timer (`cases/SlaTimer`, every 60 s, `miot.symptoms.sla.enabled`, on with the evaluator) reads the ACTIVE cases opened in the last 7 days whose current level has `operator` and `slaMinutes`, reached that level more than `slaMinutes` ago, and have no treatment that is open or was opened since the case reached the level. It writes `miot_symptoms.sla_expiry (tenant_code, case_id, level)` (V0.9.7) and publishes only when the row is new, so each case and level expires once across replicas.
