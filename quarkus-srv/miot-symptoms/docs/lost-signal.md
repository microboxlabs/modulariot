# Lost-signal detector

Detects vehicles on a trip whose GPS stopped arriving. Code: `quarkus-srv/miot-symptoms`, package `lostsignal`.

On wherever the evaluator is (`miot.symptoms.evaluator.enabled`). It only opens cases in organizations with a `trip_check` version in TEST or ACTIVE.

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

## Signal state

The maps show whether a vehicle's signal is arriving, by the detector's threshold. `SignalStates` (miot-core) is the port; the detector implements it (`SignalStateReader`) on every replica with the store. It only reads. The fleet directory's existing `NO_SIGNAL` status (after 24 hours without a signal) is independent of this detector state.

| State | When |
|---|---|
| `offline` | now − arrival of the newest frame > expected silence |
| `online` | otherwise |
| `unknown` | no vehicle profile: never seen, or the profile expired |

| Field | Meaning |
|---|---|
| `offline_since` | The newest frame's GPS time, only when offline. A late frame does not move it |
| `last_frame_at` | The newest frame's GPS time |
| `silence_s` | Now − arrival of the newest frame |
| `expected_s` | On a trip, the watch's expected silence, the one the deadline was set with, so the state turns offline when the detector's deadline passes. Off a trip, the vehicle's expected gap plus its sender's delivery delay, from the profiles |

The vehicle profile keeps the newest frame's sender (`sender`) for the off-trip case; a profile written before it falls back to the default delivery delay. Many vehicles are read in two pipelines: one `HMGET p w` per vehicle, then one `GET` per sender of the vehicles without an active trip watch. An empty-trip watch retained to clear a loss is an off-trip vehicle.

Off a trip, sender profiles stay live: a late frame can change the learned delay and therefore reclassify the state, including when the sender first has enough samples. It never changes the newest frame's GPS time or arrival. On a trip, the watch's stored expected silence stays fixed until a newer frame replaces it.

| Endpoint | Content |
|---|---|
| `GET /api/v1/orgs/{org}/control-tower/map/positions` | Each position has `signal` |
| `GET /api/v1/orgs/{org}/control-tower/map/assets/{assetId}/signal` | One asset's state; 404 when it is not among the organization's positions |

An engine case's map popup (`signals`, `description`) carries the GPS database's indicators in their names and formats:

| Field | Value |
|---|---|
| `signal_lag` | Lost signal only. Open: now − GPS time of the newest frame. Closed: the closing transition's context, from the last frame before the loss to the first frame that returned (`check.loss.returned_frame_at`), or `check.loss.silence_s` when it did not return; absent without a closing context (an operator's close) |
| `median_report_interval` | Median of the vehicle's gaps in its current motion (its most sampled motion until it has a gap there), `HH:MM:SS`; absent without a profile |
| `last_reported_engine_status` | The profile's newest frame; for a lost signal without it, `check.loss.last.engine` of the closing, level or opening context |

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

The return marker keeps both the first arrival and its GPS time in the existing `r` value; legacy arrival-only markers still read. The case map refreshes its description every 60 s while open and stops on closure or unmount.

A frame from inside the silence (taken after the newest frame before it) tells about the return: the first one on time is the return (`r` in the vehicle's hash, kept once set), and one that arrives late, or delayed by more than 2 min and the sender's usual delay, is backfill (`b`). A return without backfill waits `return-grace` (1 min) for late frames. Then one check runs with `returned: true`, and every open case the checks opened for the vehicle gets `symptom.case.signal_returned` with the return time and whether backfill came; an ACTIVE case also gets the audit entry `case.signal_returned`. The detector never closes a case; the template's close rule can close one on that check (2.2.0, below), and a case closed there gets `symptom.case.closed` instead of `signal_returned`.

### Platform template (V0.12.4)

"Pérdida de señal" 2.0.0 reads the check:

| Part | Rule |
|---|---|
| Activation | `check.trip.active && check.loss.ratio >= 1 && !check.loss.returned` |
| Measure | `check.loss.silence_s / 60.0`, minutes |
| Level 1 | `check.loss.silence_s < 1800` |
| Level 2 | `check.loss.silence_s >= 1800 && measure < 120`: L = 1800 s, after which the loss is validated |
| Level 3, 4 | 120 and 180 min |
| Close | `case.closed_by_operator`, as panic; from 2.2.0 also `case.level <= 1 && case.normal_s >= 0` |

An organization changes L by editing the level-2 rule. Symptoms copied from 1.0.0 keep their rules.

## Shadow map, group outage and nearby units

The shadow map is built each hour, in memory on every replica, from the coverage job's rows of the last 30 days ([Coverage job](#coverage-job)). A lost check reads it at the last position's cell (0.05°, about 5 km) for the vehicle's sender.

| Key | Content |
|---|---|
| `symptoms:geo:<5 min bucket>` | Where vehicles reported (GEO set, `GEOADD`), only frames newer than the vehicle's newest; TTL 15 min |
| `symptoms:lost:<sender>` | The sender's lost vehicles (set); TTL 1 day |
| `symptoms:cohort:<sender>` | How many of the sender's vehicles are usually lost at once; time-weighted, 6 h half-life |

| Field | Rule |
|---|---|
| `check.loss.low_coverage_zone` | The map says the cell is shadow for the sender: by the sender's own rows, or by a consensus of other senders |
| `check.loss.coverage_share` | The cell's share of delayed and missing frames, for the sender (`sender`) or pooled over the other senders (`consensus`); absent with `none` |
| `check.loss.coverage_source` | `sender`, `consensus` or `none` |
| `check.loss.cohort_outage` | The sender has at least 3 vehicles lost and at least 3 × its usual count |
| `check.loss.nearby_reporting` | Vehicles that reported in the last two GEO buckets within 10 km of the last position (`GEORADIUS`, which older Redis also has) |

The return check carries `false`, `none` and `0`.

Template 2.1.0 (V0.12.5): while `cohort_outage` or `low_coverage_zone` holds, the case stays at level 1 until 180 min, when it reaches level 4 anyway.

Template 2.2.0 (V0.12.11) closes a case that never left level 1 when the signal returns: `case.closed_by_operator || (case.level <= 1 && case.normal_s >= 0)`. `case.level` is the highest level the case reached. The return check (`returned: true`) stops the activation, so `case.normal_s` is 0 on it and the case closes. A case that reached level 2 or more stays open for the operator. The rest of the spec is 2.1.0's.

The map reloads every `miot.symptoms.lost-signal.coverage.reload-every` (default `1h`), first 20 s after start. Until the job has filled a day, the map is empty and `low_coverage_zone` is false.

Each reload reads cell counts and sender totals from one database snapshot. A failed reload keeps the previous map.

## Coverage job

`CoverageJob` builds the shadow map's day rows from `asset_data`, all vehicles of all clients. Delay is `request_timestamp - timestamp`; the sender is `client_id`.

| Step | What it does |
|---|---|
| Schedule | Every 10 minutes (`coverage.every`); a run with nothing to fill is a few small queries. Counters `miot_symptoms_lost_signal_coverage_days_filled_total`, `_coverage_lease_held_total` and `_coverage_failed_total` show it working where logs are at ERROR. Fills each day of the last 30 that is not in `coverage_run`, newest first. Yesterday is ready 2 h after midnight UTC (`coverage.settle`). |
| Read | One hour of `asset_data` at a time through the `gps-read` datasource, SELECT only. First pass: delay and interval counts per sender and second, for the day's medians. Second pass: the frames ordered by asset, sender and time, plus the hour before the day for gaps across midnight. |
| Write | Replaces the day in `coverage_day` and `coverage_sender_day` in one transaction, then marks it in `coverage_run`. Deletes days older than the window and recomputes `anomalous`. |
| Leader | The replica holding the Redis lease `symptoms:coverage:lease` (10 min, renewed every hour read). Without Redis every replica runs it. |
| On | Where the detector runs (`miot.symptoms.evaluator.enabled`), the GPS database is configured and `coverage.job-enabled` is true (default). |

| Rule | Definition |
|---|---|
| Delayed frame | delay > max(floor, median-factor x the sender's median delay that day) |
| Gap | Consecutive frames of one asset and sender with dt > max(floor, median-factor x the sender's median interval that day), distance >= gap-min-km and distance / dt <= gap-max-kmh. `dt / median interval - 1` frames are missing, spread evenly over the cells the straight line crosses. |
| Share | (delayed + missing) / (frames + missing) |
| Sender decides | With >= min-frames weighted frames in the cell: shadow when share >= max(min-share, over-sender x the sender's share everywhere) |
| Consensus | Otherwise: at least `consensus` other senders that decide the cell alone; shadow when that many of them see shadow |
| Anomalous day | A sender-day with share >= anomaly-share and > anomaly-factor x the sender's median daily share over the window is left out |
| Window | The last 30 days, each weighted 0.5^(age / half-life); yesterday is 1 day old |

| Table | Key | Columns |
|---|---|---|
| `miot_symptoms.coverage_day` | sender, cell, day | frames, delayed, missing |
| `miot_symptoms.coverage_sender_day` | sender, day | frames, delayed, missing, median_delay_s, median_interval_s, anomalous |
| `miot_symptoms.coverage_run` | day | frames, finished_at |

Settings under `miot.symptoms.lost-signal.coverage.`:

| Setting | Default |
|---|---|
| `floor` | `PT10M` |
| `median-factor` | 3 |
| `min-frames` | 20 |
| `min-share` | 0.3 |
| `over-sender` | 2 |
| `consensus` | 2 |
| `window` | `P30D` |
| `half-life` | `P7D` |
| `gap-min-km` | 2 |
| `gap-max-kmh` | 150 |
| `anomaly-share` | 0.3 |
| `anomaly-factor` | 3 |
| `job-enabled` | true |
| `every` | `1h` |
| `settle` | `PT2H` |
| `reload-every` | `1h` |

## GPS sabotage template

"Desactivación o sabotaje de GPS" (`gps-sabotage`, V0.12.6) is a separate platform template on `gps_signal`, driven by device events instead of silence: on a trip, `signal.?derived.?power_disconnected == TRUE || signal.?derived.?jamming == TRUE` opens a level-4 case (operator, 2 min SLA) that only an operator closes, as panic. In the Mintral recon the power events were `ALIMENTACION BATERIA DESCONECTADA` (40 frames) and `EVENTO_SMDP_ALIMENTACION_EXTERNA_DESCONECTADA` (23); no jamming event appeared. A jammer that also blocks GSM delivers the event when the device reconnects, as a late frame.
