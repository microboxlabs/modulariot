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
| Silent | Lost since its newest frame; checked again every `recheck-every` |
| A frame newer than the loss | Returned: lost cleared, deadline back to arrival + expected silence. A frame from a lost vehicle sets its deadline to now, so the return is checked on the next tick |
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
