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
| `MIOT_SYMPTOMS_LOST_SIGNAL_ENABLED` | Update the profiles | `false` |
| `MIOT_SYMPTOMS_LOST_SIGNAL_PROFILE_TTL` | How long a profile lives after its last frame | `P7D` |
| `MIOT_SYMPTOMS_LOST_SIGNAL_MIN_SAMPLES` | Gaps or delays before a profile replaces the default | `20` |
| `MIOT_SYMPTOMS_LOST_SIGNAL_GAP_MARGIN` | Factor on the p95 gap | `1.5` |
| `MIOT_SYMPTOMS_LOST_SIGNAL_DELAY_QUANTILE` | Quantile of the sender's delays | `0.9` |
| `MIOT_SYMPTOMS_LOST_SIGNAL_MAX_DELAY` | Cap on the sender's delay | `PT1H` |

A failed profile update is counted (`miot.symptoms.lost_signal.failed`) and does not redeliver the signal.
