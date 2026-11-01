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
| `signal.trip` | `active`, `double_driver`, `id` (the trip's UUID), `code` (service code), `type`, `status` (service status), `age_min`, `late_min`, `origin`, `destination`, `current_zone_id`, `carrier`, `load_type`, `trailer_plate` | `miot_trips.trip_live` of the organization |
| `signal.trip.carrier` | `id` (tax id), `name` | `miot_fleet.carrier` |
| `signal.trip.driver` | `id` (fleet id), `registered`, `status`, `license_expired` | `miot_fleet.driver`, found by the trip's `driver_id` (tax id) |
| `signal.vehicle` | `weight_category`, `weight_kg` | vehicle data |
| `signal.road` | `maxspeed_osm`, `maxspeed_custom` | road network, client limits |
| `signal.geo` | `authorized_zone`, `zone` | geofences |
| `signal.local_hour` | Hour in the client's time zone | calculated |
| `signal.derived` | `moving`; `speed_avg_5m` (not evaluated yet) | calculated |
| `signal.frame` | The frame as the device sent it (`AssetTrackingData`), for example `signal.frame.gps.speed` (km/h), `signal.frame.sensors.engine_status`, `signal.frame.sensors.panic_button` | device |

A part the builder does not know is left out. `frame` is always present. A rule that reads a missing field fails for that signal and is reported as a rule error. A rule reads an optional field with `.?`, which gives an optional value instead of an error, and compares it with `TRUE`, `FALSE` or `NONE` (`optional.of(true)`, `optional.of(false)`, `optional.none()`):

| Rule | Holds when |
|---|---|
| `signal.frame.?sensors.?panic_button == TRUE` | the device sent the button pressed |
| `signal.frame.?sensors.?panic_button == FALSE` | the device sent the button not pressed |
| `signal.frame.?sensors.?panic_button == NONE` | the device did not send it |
| `signal.frame.?gps.?speed.orValue(0.0) > 90.0` | speed above 90; 0 when missing |

`has(signal.frame.sensors) && has(signal.frame.sensors.panic_button) && signal.frame.sensors.panic_button` still works.

## Signal builder

`SignalStream` reads `tracking/asset-positions` (`Key_Shared`, subscription `miot-signal-builder`) and publishes the signal to `tracking/asset-signals`, keyed by `asset_id`.

| Part | How it is built |
|---|---|
| `clients` | The sending client (without `@clients`), then the clients of the vehicle's active `asset_client_map` rows valid at the frame time |
| `sender` | The sending client (without `@clients`); hidden from rules, read by the evaluator's late counter and the lost-signal detector |
| `trips` | For each client, its `trip_live` row in progress on the vehicle at the frame time (departed, not ended); `v` trips before `ote`/`otr`, then the latest start. The evaluator gives each organization its own as `trip`, or `{"active": false}`; rules never read `trips` |
| `trip.age_min`, `trip.late_min` | Minutes from the trip start and from `estimated_arrival_time` to the frame time; `late_min` is negative before the estimated arrival |
| `trip.current_zone_id` | `current_geofence_id`; 0 is left out |
| `trip.code` | The first service code of the trip |
| `trip.driver` | The organization's fleet driver with the trip's `driver_id` (tax id), an `active` one first. `registered` is false when the fleet has no such driver; left out when the trip has no driver. Fleet `inactive` reads `DEACTIVATED`. The tax id, name and phones never reach the signal |
| `derived.moving` | Frame speed above 10 km/h, as the GPS database's signal function; left out when the frame has no `gps` |
| `local_hour` | Frame time in `MIOT_SYMPTOMS_SIGNAL_BUILDER_ZONE` (default `America/Santiago`) |
| `vehicle`, `road`, `geo`, `derived.speed_avg_5m` | Not built yet: left out |

Trips are loaded from the modulith database and shares (`asset_client_map`) from the GPS database, at start and every `MIOT_SYMPTOMS_SIGNAL_BUILDER_RELOAD_EVERY` (10 min). Between loads, each change of a `trip_live` row sends a notice on the Postgres channel `miot_trips_live` (`{"tenant", "tripId"}`), and the builder reads that row again; shares follow their Debezium topic (a non-durable subscription, so a stopped replica leaves no backlog). Without a trips module the signal has no trips. Frames wait for the first load, which is retried until the databases answer. On wherever the symptoms Pulsar is wired (`MIOT_SYMPTOMS_CDC_ENABLED`, which follows the symptoms component); `MIOT_SYMPTOMS_SIGNAL_BUILDER_ENABLED=false` turns it off. Frames are counted (`miot.symptoms.signal.built`, `.skipped`), never logged.

## Rule editor fields

| Annotation | Field property |
|---|---|
| `title` | label |
| `x-unit` | unit |
| `x-origin` | origin; a part's origin applies to its fields |
| `x-type` | type, when the Java type is not enough (`zone`) |
| `x-engine: false` | the engine does not evaluate it yet |
| `hidden` | not a field |

Not fields: `signal.frame.asset_id` (same as `signal.asset_id`), driver data (read it from the trip), peripherals, metrics, events and other lists, and optional readings that gps-model holds as primitives (`gps.altitude`, `gps.heading`, `gps.satellites`, `gps.accuracy`). A primitive reads 0 when the device did not send it, so a rule could not tell a missing reading from a zero one. `gps.speed` is a field anyway: a frame without speed reads 0, as a stopped vehicle.

To add a field: add it to `GpsSignal` (or to gps-model for frame fields) with its annotations. A frame field also needs a label in `gps-signal-labels.properties`; `SignalFieldsTest` fails until it has one.
