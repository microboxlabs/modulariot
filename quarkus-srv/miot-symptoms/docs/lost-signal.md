# Lost-signal detector

Detects vehicles on a trip whose GPS stopped arriving. Code: `quarkus-srv/miot-symptoms`, package `lostsignal`.

**Status: off** (`MIOT_SYMPTOMS_LOST_SIGNAL_ENABLED`).

## Arrival profiles

Every signal the evaluator reads, on time or late, updates two profiles: one read and one write to Redis per signal, pipelined.

| Profile | Key | Content |
|---|---|---|
| Vehicle | `symptoms:veh:<asset>`, field `p` | Newest frame time and its arrival, last arrival of any frame, the newest frame's motion and position, and the gaps between newest frames by the motion of the frame before the gap |
| Sender | `symptoms:snd:<sender>` | Delivery delay (arrival − frame time) of every frame |

A frame older than the newest never moves the newest frame back, and a frame with the same time counts no gap. Arrival is the time the signal builder published the signal (Pulsar publish time).

| Motion | Rule |
|---|---|
| Engine off | `frame.sensors.engine_status` is false |
| Moving | Not engine off, speed > 10 km/h |
| Stopped | Otherwise |

Each profile is a decayed histogram on fixed bounds (1 s to 6 h) plus an EWMA (`Sketch`). Each new value first scales the old weights by `1 − 1/memory`, so the vehicle remembers about 500 gaps per motion and the sender about 5,000 frames. A quantile is its bucket's upper bound.

| Value | Rule |
|---|---|
| Expected gap | p95 of the vehicle's gaps in its current motion × 1.5, once it has 20 of them; before, the larger of that and the motion's default (moving 2 min, stopped 5 min, engine off 1 h). At least 1 min |
| Delivery delay | p90 of the sender's delays, once it has 20; before, 1 min. At most 1 h |
| Expected silence | Expected gap + delivery delay |

| Setting | Meaning | Default |
|---|---|---|
| `MIOT_SYMPTOMS_LOST_SIGNAL_ENABLED` | Update the profiles, the deadlines and run the ticker | `false` |
| `MIOT_SYMPTOMS_LOST_SIGNAL_PROFILE_TTL` | How long a profile lives after its last frame | `P7D` |
| `MIOT_SYMPTOMS_LOST_SIGNAL_MIN_SAMPLES` | Gaps or delays before a profile replaces the default | `20` |
| `MIOT_SYMPTOMS_LOST_SIGNAL_GAP_MARGIN` | Factor on the p95 gap | `1.5` |
| `MIOT_SYMPTOMS_LOST_SIGNAL_DELAY_QUANTILE` | Quantile of the sender's delays | `0.9` |
| `MIOT_SYMPTOMS_LOST_SIGNAL_MAX_DELAY` | Cap on the sender's delay | `PT1H` |

A failed profile update is counted (`miot.symptoms.lost_signal.failed`) and does not redeliver the signal.

## Deadlines and ticker

A frame newer than the vehicle's newest one, from a vehicle on a trip with any organization, sets its deadline: arrival + expected silence. The frame also leaves a watch for the check: each organization's trip as the signal carried it, the expected silence and the sender. Off every trip, the deadline and the watch are dropped. A late frame or a replay leaves both.

| Key | Content |
|---|---|
| `symptoms:deadlines` | Sorted set of vehicles by deadline (epoch ms) |
| `symptoms:veh:<asset>`, field `w` | The watch, written by frames |
| `symptoms:veh:<asset>`, field `c` | The check state, written by the ticker: since when the vehicle is lost |
| `symptoms:lost-signal:lease` | The replica that runs the ticker (`SET NX PX`, renewed by its holder) |
| `symptoms:ingest` | One heartbeat per replica: when it last read a signal and how far behind its publish time |

Every `tick-every`, the replica holding the lease takes the vehicles whose deadline passed (at most 500 per tick, earliest first) and checks each one:

| Found | Then |
|---|---|
| No watch (trip ended or keys expired) | Dropped from the deadlines |
| Deadline not passed (a frame moved it meanwhile) | Moved to the new deadline |
| Silent | Lost since its newest frame; its `trip_check` check runs, then again every `recheck-every` |
| A frame newer than the loss | Returned (see below): lost cleared, deadline back to arrival + expected silence. A frame from a lost vehicle sets its deadline to now, so the return is checked on the next tick |
| Silent past `max-silence` | Dropped from the deadlines; still lost, so a later frame returns it |

A check reschedules with `ZADD XX`, so a vehicle a frame dropped meanwhile stays dropped, and a lease that moves to another replica repeats nothing. Counters: `miot.symptoms.lost_signal.checks` (tag `outcome`), `check_failed`, `paused` (tag `reason`).

Ingest-health guard: the ticker pauses when no replica read a signal for `ingest-stale-after` (`stale`), or a replica that did reads more than `ingest-max-lag` behind the signal's publish time (`lag`). A silence then may be ours, not the vehicle's. The heartbeat is written at most once per second per replica. With a fleet that can be silent for minutes (a demo), set `ingest-stale-after` to `0`.

| Setting | Meaning | Default |
|---|---|---|
| `MIOT_SYMPTOMS_LOST_SIGNAL_TICK_EVERY` | Ticker period | `5s` |
| `MIOT_SYMPTOMS_LOST_SIGNAL_RECHECK_EVERY` | How often a lost vehicle is checked again | `PT1M` |
| `MIOT_SYMPTOMS_LOST_SIGNAL_MAX_SILENCE` | When a lost vehicle stops being checked | `P1D` |
| `MIOT_SYMPTOMS_LOST_SIGNAL_INGEST_STALE_AFTER` | No signal read for this long pauses the ticker; `0` turns the guard off | `PT2M` |
| `MIOT_SYMPTOMS_LOST_SIGNAL_INGEST_MAX_LAG` | A replica reading further behind pauses the ticker | `PT2M` |

## The `trip_check` source

Each check runs the organization's TEST and ACTIVE `trip_check` versions with the evaluator's `SignalEvaluator`, episodes (`symptoms:ep:<tenant>:<asset>`, its own watermark `wm:trip_check`), transition log and case events (`TripChecks`). The fields are declared in code, `signal/TripCheck`, read by `SignalFields` the way `GpsSignal` is.

| Field | Meaning |
|---|---|
| `check.trip.*` | The trip as the vehicle's newest signal carried it, same fields as `signal.trip.*` (driver included) |
| `check.signal_lost_minutes` | `silence_s / 60` |
| `check.loss.silence_s` | Now minus the newest frame's time |
| `check.loss.expected_s` | Expected gap + delivery delay when the newest frame arrived |
| `check.loss.ratio` | `silence_s / expected_s`; at least 1 on a lost check |
| `check.loss.last.lat`, `.lon`, `.speed`, `.engine` | The newest frame |
| `check.loss.sender` | The client that sends the frames |
| `check.loss.returned`, `check.loss.backfill` | Only on the return check |
| `check.driving_minutes`, `check.resting_minutes` | Declared for the continuous-driving rules, not computed (`x-engine: false`, TEST only) |

The case's trip, driver and position are the trip's and the newest frame's.

### Return

A frame from inside the silence (taken after the newest frame before it) tells about the return: the first one on time is the return (`r` in the vehicle's hash, kept once set), and one that arrives late, or delayed by more than 2 min and the sender's usual delay, is backfill (`b`). A return without backfill waits `return-grace` (1 min) for late frames. Then one check runs with `returned: true`, and every open case the checks opened for the vehicle gets `symptom.case.signal_returned` with the return time and whether backfill came; an ACTIVE case also gets the audit entry `case.signal_returned`. The detector never closes a case.

### Platform template (V0.12.4)

"Pérdida de señal" 2.0.0 reads the check:

| Part | Rule |
|---|---|
| Activation | `check.trip.active && check.loss.ratio >= 1 && !check.loss.returned` |
| Measure | `check.loss.silence_s / 60.0`, minutes |
| Level 1 | `check.loss.silence_s < 1800` |
| Level 2 | `check.loss.silence_s >= 1800 && measure < 120`: L = 1800 s, after which the loss is validated |
| Level 3, 4 | 120 and 180 min |
| Close | `case.closed_by_operator`, as panic |

An organization changes L by editing the level-2 rule. Symptoms copied from 1.0.0 keep their rules.

## Shadow map, group outage and nearby units

Every frame with a position adds to its grid cell (0.05°, about 5 km) of the shadow map, late frames too: they carry the real position of a silence. A frame is delayed when it arrives later than max(2 min, 3 × its sender's median delay), so a sender that forwards in batches is not read as poor coverage everywhere. Counters fade with a 7-day half-life.

| Key | Content |
|---|---|
| `symptoms:cov:<sender>`, `symptoms:cov:*` | Per cell: frames, delayed frames and the last update (`{"f","d","t"}`), per sender and for all senders; TTL 30 days |
| `symptoms:geo:<5 min bucket>` | Where vehicles reported (GEO set, `GEOADD`), only frames newer than the vehicle's newest; TTL 15 min |
| `symptoms:lost:<sender>` | The sender's lost vehicles (set); TTL 1 day |
| `symptoms:cohort:<sender>` | How many of the sender's vehicles are usually lost at once; time-weighted, 6 h half-life |

| Field | Rule |
|---|---|
| `check.loss.low_coverage_zone` | The last position's cell has at least 20 frames and a delayed share ≥ max(0.3, 2 × the sender's own share everywhere), or ≥ 0.3 for all senders together |
| `check.loss.cohort_outage` | The sender has at least 3 vehicles lost and at least 3 × its usual count |
| `check.loss.nearby_reporting` | Vehicles that reported in the last two GEO buckets within 10 km of the last position (`GEORADIUS`, which older Redis also has) |

The frame reads and writes the cells in the same pipelined round trips as the profiles. The return check carries `false` and `0` for the three.

Template 2.1.0 (V0.12.5): while `cohort_outage` or `low_coverage_zone` holds, the case stays at level 1 until 180 min, when it reaches level 4 anyway.

### First load

`scripts/coverage-seed/` builds an initial 30-day map outside the runtime: `export.sql` exports one day of frames read-only, `seed.py` turns them into `HSET` commands in the detector's format. Review the output before piping it to `redis-cli`; it has not been run against any environment.
