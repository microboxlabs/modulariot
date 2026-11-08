# Symptom evaluator

Runs published symptom versions on a vehicle's signals and keeps one episode per vehicle and symptom. It turns each signal into at most one case change per symptom: opened, level changed or closed.

**Status: on.** An organization without TEST or ACTIVE `gps_signal` symptoms costs one cached catalog read every 30 s and one sample write every 15 s. `EvaluatorStream` reads `tracking/asset-signals` (built by the signal builder, [gps-signal.md](gps-signal.md)) for every organization in the signal's `clients`, keeps episodes in Redis and records every case change in `miot_symptoms.signal_transitions`. An ACTIVE OPENED transition is a Control Tower case (see Cases below); TEST transitions are shadow counts.

| Setting | Meaning | Default |
|---|---|---|
| `MIOT_SYMPTOMS_EVALUATOR_ENABLED` | Consume signals | follows the signal builder |
| `MIOT_SYMPTOMS_EVALUATOR_REDIS_URL` | `redis://:password@host:6379`; unset keeps episodes in memory (one replica only) | unset |
| `MIOT_SYMPTOMS_EVALUATOR_EPISODE_TTL` | How long a vehicle's episodes live after their last write | `P7D` |
| `MIOT_SYMPTOMS_EVALUATOR_CONCURRENCY` | Vehicles evaluated at once per replica (`gps-signals-in` channel copies) | `1` |
| `MIOT_SYMPTOMS_EVALUATOR_REDIS_POOL_SIZE` | Redis connections of the evaluator, the lost-signal detector and the samples | `16` |
| `MIOT_SYMPTOMS_EVALUATOR_REDIS_POOL_WAITING` | Redis requests queued for a connection | `256` |

Redis holds one hash per organization and vehicle, `symptoms:ep:<tenant>:<asset>`: a field `ep:<symptom id>` per episode (JSON) and `wm:<source>` per watermark. The subscription is `Key_Shared` on `asset_id`, so one vehicle's signals are evaluated in order on one replica. An operator close advances a revision in the episode hash atomically with its marker. Both consumers install the same marker atomically, keeping trip suppression visible between their close operations. A save from an older revision fails and retries with the new state. Transitions and events are still emitted before the guarded save, so this protects close markers without making the database/event side effects atomic with the operator close.

Each replica runs `MIOT_SYMPTOMS_EVALUATOR_CONCURRENCY` copies of the channel, each its own `Key_Shared` consumer that evaluates its signals one at a time, so a vehicle's signals stay in order while other vehicles run beside them. A signal spends most of its time waiting on Redis and Postgres. Per organization, a signal reads the episode hash and then the duty counters in one pipeline (Redis runs them in order, so the close revision is never newer than the counters), runs the `gps_signal` and duty symptoms on that state, and writes the hash once and the counters after it. These reads go out before the lost-signal detector's, so they overlap. The holds are read once per organization and signal. Measure with `EvaluatorBenchmarkTest` (`-Dmiot.symptoms.benchmark=true`): the platform templates on synthetic signals over an in-memory Redis with a set latency.

One ordered consumer remains the default. Set `MIOT_SYMPTOMS_EVALUATOR_CONCURRENCY=8` only after validating per-vehicle ordering, nack/redelivery and Redis pool saturation against a real broker and Redis in a test environment. The synthetic benchmark verifies evaluator state in vehicle-keyed lanes; it does not exercise the broker or its failures.

A signal whose Redis, catalog or database call fails is redelivered (twice at most); the transition is written before the episode, and a replay does not write it again.

An expiring set per vehicle, `symptoms:ep-tenants:<asset>`, indexes organizations with unfinished episodes. When an organization leaves the signal's `clients` (for example, its last trip ends), the evaluator reconciles its existing episodes with only the vehicle id, time and `trip.active: false`. An activation that is false on that input starts or advances the normal timer; its lifecycle still decides when to close. An activation needing unavailable GPS fields stays unknown, and operator-only cases stay open. Reconciliation keeps no samples, carries no GPS position or speed, and opens no cases. The index is updated atomically with the episodes and also exists in memory without Redis.

Previews treat samples independently. Recent signals carry no case age, so `open_s` defaults to 0; they cannot preview repeated-event escalation on an existing case. Samples supplied directly to `PreviewService.run` can include a numeric `open_s`.

Rule previews use the organization's recent signals. At most one signal per organization every 15 s goes to the list `symptoms:samples:<tenant>` (newest 20, expires a day after the last one). The 15 s are checked in Redis (`symptoms:samples:<tenant>:gate`, in the same script as the list), so replicas share them. Only the paths of the rule editor's fields are saved: `schema`, `at`, `clients`, the frame's driver data, lists and times are dropped. An organization with no recent signals previews on the fixed samples in `symptoms/gps-signal-samples.json`.

| | |
|---|---|
| Code | `quarkus-srv/miot-symptoms`, package `evaluator` |
| Input | Tenant, vehicle id, signal time, the source object (for `gps_signal`, the map under `signal`, see [gps-signal.md](gps-signal.md)), the compiled versions |
| Output | `Transition`s (`OPENED`, `LEVEL_CHANGED`, `CLOSED`, `HELD`) with version, state, level and measure; `RuleError`s for rules that failed |
| State | `Episode` per tenant, vehicle and symptom, through `EpisodeStore` |

## How a signal is read

| Step | Rule |
|---|---|
| Candidate | The version's activation is true |
| Measure | The measure expression; 0 when the version has none |
| Hold time, threshold rules | A level rule that holds given enough time (`measure >= 21 && held_s >= 60`) counts `held_s` from the first signal where it would hold: how long the measure met that threshold |
| Hold time, time rules | Any other rule (`held_s >= 600 && held_s < 1200`) counts `held_s` from the start of the activation's run |
| Case age | `open_s` is the time since the case opened, 0 while none is open. A level rule on it escalates an open case each time the activation holds again, for example a repeated device event (`open_s >= 900`) |
| Level | The highest level whose rule holds. If none holds while a threshold rule waits for its hold time, the case is at the applying level below it |
| Condition | Holds while a candidate reaches a level. `case.condition_s` counts from its first signal; `case.normal_s` from the first signal after it stopped, and is -1 while it holds |
| Open | No case open, the condition holds and the lifecycle's open rule is true |
| Level change | A case's level only rises, unless the lifecycle's `levelDown` lets it follow the measure down while the condition holds |
| Close | The lifecycle's close rule is true. If the condition still holds, the next signal starts a new run |

`case.off_trip_s` counts from the first observed off-trip frame of an open case and resets on a trip; it is -1 while on a trip or without trip evidence. Cargo rules require both 1200 seconds off a trip and 1200 seconds without their event.

`case.age_h` is the time since the case opened, in hours; `case.level` its level: the highest it reached, unless `levelDown` is set. `case.closed_by_operator` is false: operators close cases through the treatment API, not through signals. `case.closed_on_trip` is true when an operator closed a case of the symptom on the trip the signal carries (`trip.id`); an open rule `case.condition_s >= 0 && !case.closed_on_trip` opens no other case on that trip. The episode keeps the trip until a newer ordinary signal of another trip, or of none; buffered frames from older trips cannot clear it. `case.closed_on_trip_s` is the time since that close, -1 without one: `!case.closed_on_trip || case.closed_on_trip_s >= 18000` opens again 5 h after it.

## Order, versions and failures

- Per vehicle and source, a signal not newer than the last one applied is ignored. This watermark is kept even when the episodes are not.
- Each frame of an organization with `trip_check` symptoms that read the driving, rest or duty minutes also goes through the duty tracker, and those symptoms run on its check ([duty-tracker.md](duty-tracker.md)).
- A `gps_signal` signal older than the organization's watermark is late: counted as `miot.symptoms.evaluator.late` (tag `sender`, the sending client's first 8 characters) and handed to `LateFrames`. Only the event-driven symptoms run on it: those whose activation reads a device event (`signal.frame.sensors.panic_button`, `signal.derived.power_disconnected`, `signal.derived.jamming`), since a device delivers stored events after a newer fix. They run without moving the watermark, and one with an open case opens nothing new. A buffered repeat may raise its level using the event timestamp and case age; it preserves the latest signal and every run timer, never lowers a level, and respects holds. The other symptoms skip it. A signal with the same time as the watermark is a replay, not late.
- A device-events signal (`miot.gps.signal.events@1`, [gps-signal.md](gps-signal.md#device-events-outside-the-frames)) runs the event-driven symptoms as a late frame does, whatever its time, and never moves the watermark. It is counted as `miot.symptoms.evaluator.device_events` and is not handed to the lost-signal detector.
- A new version takes over an open case; the levels' hold times start again under its thresholds.
- An episode is kept while the activation runs, a level waits or a case is open. A vehicle off its candidate costs no storage.
- A rule that fails on a signal (a missing field, a measure that is not a number) is reported as a `RuleError` for that symptom; its episode stays as it was and the other symptoms still run.
- OFF versions are not compiled. TEST transitions are for shadow counts; ACTIVE ones create cases.

## Cases

An ACTIVE OPENED row of `signal_transitions` is a Control Tower case until a CLOSED row for the same symptom and vehicle. The Control Tower API serves them next to the GPS database's symptoms (`cases/EngineCaseService`):

| Endpoint | What changes |
|---|---|
| `GET …/control-tower/map/symptoms` | Page 1 lists the matching cases first, in the GPS function's row shape, with their count in `engine_cases`; the paging totals stay the GPS function's. Cases answer `p_trip_id`, `p_asset_id` (part of the plate), `p_symptom_name`, `p_icu_code` (current level) and the dates: without dates the open cases, with them the cases opened in the range, closed ones with `end_time`. A driver, carrier, origin or destination filter leaves them out. They still show when the GPS database cannot be read |
| `GET …/map/symptoms/{id}`, `…/{id}/signals` | A negative id is a case: header from the catalog and the trip's `trip_live` row while it runs, and the signal's point as an EWKB feature with the case's `icu_code`. The case runs from its start until it closed or now: the start is `check.loss.last.at` (the last frame before the silence) when the opening context has it, else the opening. The header adds `symptom_info.opened_at`, `started_at`, `duration_sec` and `level_reason`: `icu_code`, `icu_condition`, `rule` (the level's `when` in the version that opened the case), `context` (null when not kept), `lost_since` and `levels` (`at`, `icu_code` of each change, oldest first). For a symptom whose measure is the speed minus `signal.road.maxspeed_osm` or `maxspeed_custom`, each level step, the signals' `description` (from the change that set the level) and the case point (from the opening) add `speed` and `speed_limit` in km/h, as the GPS database names them, with `speed_limit_source` (`road`, `custom`) and `speed_limit_zone` (the own zone's name, when known). The limit is the change's `context.speed_limit`; a change written before it was kept derives it as the rounded speed minus the measure |
| `POST …/treatments/{id}/close` | Closing the treatment of a case closes the case (CLOSED row with `closed_by`) and drops its Redis episode, so the next signal that meets the condition opens a new case |

While an "Ignorar condición" hold covers an ACTIVE symptom on the vehicle (`cases/HoldIndex`, see [control-tower-api.md](control-tower-api.md)), its open case keeps its level and may still close, and a case that would open does not: the first such opening of a run is a `HELD` row (V0.12.13), evidence only, with no event. The level hold times restart with the first signal after the hold.

A case's symptom id is the OPENED row's id negated, so it never meets a GPS database symptom id in `treatment` and `audit_event`. The row keeps the signal's trip, position and speed (V0.8.5). A trip check's OPENED and LEVEL_CHANGED rows also keep, in `context` (V0.12.10), the check the rules read without its trip: `{"check": {"signal_lost_minutes", "loss": {...}}}`. The case's level context is that of the row that set its level. A GPS signal's rows of a symptom that reads `signal.road` keep the limits it compared the frame with: `{"speed_limit": {"kmh", "source", "road_kmh", "custom_kmh", "osm_way_id", "road_class", "zone_id", "zone_name"}}`; `kmh` is the own limit when there is one (`source` `custom`), else the road's (`road`).

## Case events

Each new transition, and an operator's close, is published in-process as an `OperationalEvent` (`miot-core`, `core.event`) with `Event.fireAsync` (`events/SymptomEvents`). A replayed signal publishes nothing again: the log returns only the rows it inserted.

| Type | When |
|---|---|
| `symptom.case.opened` | OPENED transition |
| `symptom.case.level_changed` | LEVEL_CHANGED transition |
| `symptom.case.closed` | CLOSED transition, or `POST …/treatments/{id}/close` (`closedBy` set) |
| `symptom.case.sla_expired` | The SLA timer, see below |
| `symptom.case.signal_returned` | The lost-signal detector: the vehicle of an open `trip_check` case reports again (`signalReturnedAt`, `backfill`). A case that the return check closed gets `symptom.case.closed` instead. An ACTIVE case also gets a `case.signal_returned` audit entry ([lost-signal.md](lost-signal.md)) |

`source` is `miot-symptoms`, `context` is `{kind: "symptom_case", key: "<symptom id>"}` (the negated OPENED id), `data` is `SymptomCaseData`. TEST symptoms publish with `test: true`. `SymptomEventCatalog` lists the types and the payload class.

The SLA timer (`cases/SlaTimer`, every 60 s, `miot.symptoms.sla.enabled`, on with the evaluator) reads the ACTIVE cases opened in the last 7 days whose current level has `operator` and `slaMinutes`, reached that level more than `slaMinutes` ago, and have no treatment that is open or was opened since the case reached the level. It writes `miot_symptoms.sla_expiry (tenant_code, case_id, level)` (V0.9.7) and publishes only when the row is new, so each case and level expires once across replicas.
