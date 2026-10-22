# GPS signal `miot.gps.signal@1`

One GPS frame as symptom rules read it, under the CEL root `signal`. The signal builder publishes it; the evaluator reads it.

| | |
|---|---|
| Code | `signal/GpsSignal.java` |
| Rule editor fields | Read from `GpsSignal` and the gps-model classes of its frame by `SignalFields`. They are the fields of the `gps_signal` source |
| Labels | `@Schema(title)` on `GpsSignal`; for frame fields, `symptoms/gps-signal-labels.properties` (`path = label\|unit`) |

## Parts

| Path | What | From |
|---|---|---|
| `signal.schema` | `miot.gps.signal@1` | builder |
| `signal.asset_id` | Vehicle id as the device sends it | frame |
| `signal.at` | Frame time | frame |
| `signal.clients` | Client ids the vehicle belongs to | `asset_client_map` |
| `signal.trip` | `active`, `double_driver`, `id`, `type`, `age_min`, `late_min`, `origin`, `destination`, `current_zone_id`, `carrier`, `load_type`, `trailer_plate` | `live_trip` |
| `signal.trip.driver` | `id`, `registered`, `status`, `license_expired` | `ams.rd_drivers`, found by the trip's `driver_id` |
| `signal.vehicle` | `weight_category`, `weight_kg` | vehicle data |
| `signal.gps` | `speed_kmh`, `engine_on`, `moving` | frame, calculated |
| `signal.road` | `maxspeed_osm`, `maxspeed_custom` | road network, client limits |
| `signal.geo` | `authorized_zone`, `zone` | geofences |
| `signal.local_hour` | Hour in the client's time zone | calculated |
| `signal.derived` | `speed_avg_5m` (not evaluated yet) | calculated |
| `signal.frame` | The frame as the device sent it (`AssetTrackingData`), for example `signal.frame.sensors.panic_button` | device |

A part the builder does not know is left out. A rule that reads a missing field fails for that signal and is reported as a rule error. A rule that reads an optional field guards it with `has()`, for example `has(signal.frame) && has(signal.frame.sensors) && has(signal.frame.sensors.panic_button) && signal.frame.sensors.panic_button`.

## Signal builder

`SignalStream` reads `tracking/asset-positions` (`Key_Shared`, subscription `miot-signal-builder`) and publishes the signal to `tracking/asset-signals`, keyed by `asset_id`.

| Part | How it is built |
|---|---|
| `clients` | The sending client (without `@clients`), then the clients of the vehicle's active `asset_client_map` rows valid at the frame time |
| `trip` | The `live_trip` row in progress at the frame time (`SCHEDULED`, started, not ended); `v` trips before `ote`/`otr`, then the latest start. As the GPS database's signal function picks it |
| `trip.age_min`, `trip.late_min` | Minutes from the trip start and from `estimated_arrival_time` to the frame time; `late_min` is negative before the estimated arrival |
| `trip.current_zone_id` | `current_geofence_id`; 0 is left out |
| `trip.driver` | The `ams.rd_drivers` row with the trip's `driver_id` (the driver's national id): the trip creator's client first, then an `ACTIVE` one. `registered` is false when no row has that id. Left out until the registry is first loaded. The national id, name and phones never reach the signal |
| `gps.moving` | Speed above 10 km/h, as the GPS database's signal function |
| `local_hour` | Frame time in `MIOT_SYMPTOMS_SIGNAL_BUILDER_ZONE` (default `America/Santiago`) |
| `vehicle`, `road`, `geo`, `derived` | Not built yet: left out |

`live_trip`, `asset_client_map` and `ams.rd_drivers` are loaded from the GPS database at start and every `MIOT_SYMPTOMS_SIGNAL_BUILDER_RELOAD_EVERY` (10 min). Trips and shares are kept current between loads from their Debezium topics (non-durable subscriptions, so a stopped replica leaves no backlog). Frames wait for the first load, which is retried until the GPS database answers. On wherever the symptoms Pulsar is wired (`MIOT_SYMPTOMS_CDC_ENABLED`, which follows the symptoms component); `MIOT_SYMPTOMS_SIGNAL_BUILDER_ENABLED=false` turns it off. Frames are counted (`miot.symptoms.signal.built`, `.skipped`), never logged.

## Rule editor fields

| Annotation | Field property |
|---|---|
| `title` | label |
| `x-unit` | unit |
| `x-origin` | origin; a part's origin applies to its fields |
| `x-type` | type, when the Java type is not enough (`zone`) |
| `x-engine: false` | the engine does not evaluate it yet |
| `hidden` | not a field |

Not fields: `signal.frame.asset_id` (same as `signal.asset_id`), driver data (read it from the trip), peripherals, metrics, events and other lists, and optional readings that gps-model holds as primitives (`gps.speed`, `gps.altitude`, `gps.heading`, `gps.satellites`, `gps.accuracy`). A primitive reads 0 when the device did not send it, so a rule could not tell a missing reading from a zero one. Use `signal.gps.speed_kmh` for speed.

To add a field: add it to `GpsSignal` (or to gps-model for frame fields) with its annotations. A frame field also needs a label in `gps-signal-labels.properties`; `SignalFieldsTest` fails until it has one.
