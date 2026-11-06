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
| `signal.trip` | `active`, `double_driver`, `id` (the trip's UUID), `code` (service code), `type`, `status` (service status), `age_min`, `late_min`, `origin`, `destination`, `current_zone_id`, `carrier`, `load_type`, `trailer_plate`, `eta_deviation_min` | `miot_trips.trip_live` of the organization |
| `signal.trip.carrier` | `id` (tax id), `name` | `miot_fleet.carrier` |
| `signal.trip.driver` | `id` (fleet id), `registered`, `status`, `license_expired` | `miot_fleet.driver`, found by the trip's `driver_id` (tax id) |
| `signal.vehicle` | `weight_category`, `weight_kg` | vehicle data |
| `signal.road` | `maxspeed_osm`, `osm_way_id`, `road_class`; `maxspeed_custom`, `custom_zone_id` | the GPS database's `osm_roads_weight`; the organization's `miot_symptoms.speed_limit_zone` |
| `signal.geo` | `authorized_zone`, `risk_zone`, `outside_authorized`; `zone` (not built yet) | the GPS database's geofences of the organization |
| `signal.local_hour` | Hour in the client's time zone | calculated |
| `signal.local_minutes` | Minutes since local midnight, the seconds as a fraction (01:30:30 is 90.5) | calculated |
| `signal.derived` | `moving`; `power_disconnected`, `jamming` from the frame's events; `speed_avg_5m` (not evaluated yet) | calculated, device |
| `signal.frame` | The frame as the device sent it (`AssetTrackingData`), for example `signal.frame.gps.speed` (km/h), `signal.frame.sensors.engine_status`, `signal.frame.sensors.panic_button` | device |
| `signal.frame.events` | The frame's device events, a list. Each has `event_type`, `severity`, `description`, `timestamp` (the time of the fact, ISO-8601 UTC) and `code` (the producer's code, only on device-events signals), all text; a missing one reads `""`. A frame without events reads an empty list | device |

A part the builder does not know is left out. `frame` is always present. A rule that reads a missing field fails for that signal and is reported as a rule error. A rule reads an optional field with `.?`, which gives an optional value instead of an error, and compares it with `TRUE`, `FALSE` or `NONE` (`optional.of(true)`, `optional.of(false)`, `optional.none()`):

| Rule | Holds when |
|---|---|
| `signal.frame.?sensors.?panic_button == TRUE` | the device sent the button pressed |
| `signal.frame.?sensors.?panic_button == FALSE` | the device sent the button not pressed |
| `signal.frame.?sensors.?panic_button == NONE` | the device did not send it |
| `signal.frame.?gps.?speed.orValue(0.0) > 90.0` | speed above 90; 0 when missing |

`has(signal.frame.sensors) && has(signal.frame.sensors.panic_button) && signal.frame.sensors.panic_button` still works.

### Events

`event_type` is open text: each GPS provider sends its own codes. A rule reads the list with `exists`, `all`, `exists_one`, `filter` or `map`:

| Rule | Holds when |
|---|---|
| `signal.frame.events.exists(e, e.event_type in ["main_power_disconnect", "gps_jamming", "device_tamper"])` | the frame carries one of these events |
| `signal.frame.events.exists(e, e.event_type == "main_power_reconnect")` | the frame carries a reconnect |
| `signal.frame.events.exists(e, e.severity == "high")` | one event has high severity |

`derived.power_disconnected` and `derived.jamming` are kept for the rules that read them.

### Lifecycle

`lifecycle.open`, `lifecycle.close` and `lifecycle.note` read `case` and `signal` together. `case.closed_by_operator` is false on signals: the operator's close ends the case directly.

| Spec field | Meaning |
|---|---|
| `lifecycle.close` | When it holds on a signal of an open case, the case closes. Example: `case.closed_by_operator \|\| signal.frame.events.exists(e, e.event_type == "main_power_reconnect")` |
| `lifecycle.note` | Optional. When it holds on a signal of an open case that does not close it, the case's timeline gets an entry with the matching event's `event_type`, `description` and time, in the level step of that signal. The case does not change and no event is sent. The entry names the first event the rule holds for on its own; when it holds only for the frame as a whole, it has the frame's time and no event |

A note is a `NOTED` row of `signal_transitions`, its `context` `{"note": {"event_type", "description", "at"}}`. A database constraint allows only one note per organization, symptom, vehicle and frame time, including concurrent redeliveries.

### Late frames

A device stores events while it has no network and sends them late, after newer frames. A symptom is event-driven when one of its rules reads `signal.frame.events`, `signal.frame.sensors.panic_button`, `signal.derived.power_disconnected` or `signal.derived.jamming`. On a frame older than the newest one applied:

| Rule that reads an event | What the late frame does |
|---|---|
| Activation, open, measure or a level | Opens the case when the symptom has none open; a step that does not open is undone |
| Close or note | On an open case, and only when the frame is not older than the case: runs the close rule, else the note rule. The level does not change |

### Device events outside the frames

Events that do not travel in the GPS frames (driver app, fatigue cameras and sensors, load apps) are sent to `POST /api/v1/orgs/{org}/control-tower/device-events` ([control-tower-api.md](control-tower-api.md#device-events)). Each new event becomes a signal `miot.gps.signal.events@1` on the signals topic, keyed by vehicle:

| Part | Value |
|---|---|
| `clients` | The sending organization only |
| `event_id` | The producer's id or a derived id; transition replay protection uses it instead of the event timestamp |
| `trip` | Its trip in progress on the vehicle at the event's time (`miot_trips.trip_live`), else none |
| `frame.events` | The one event: `event_type`, `timestamp`, and `severity`, `code`, `description` when sent |
| `derived` | `power_disconnected` and `jamming` false |
| `frame.gps`, `frame.sensors`, `geo`, `road` | Absent |

The evaluator runs only the event-driven symptoms on it, as on a late frame (table above), without moving the watermark. It does not reach the lost-signal detector. Trip geofences skip it (no position).

## Signal builder

`SignalStream` reads `tracking/asset-positions` (`Key_Shared`, subscription `miot-signal-builder`) and publishes the signal to `tracking/asset-signals`, keyed by `asset_id`.

| Part | How it is built |
|---|---|
| `clients` | The sending client (without `@clients`), then the clients of the vehicle's active `asset_client_map` rows valid at the frame time |
| `sender` | The sending client (without `@clients`); hidden from rules, read by the evaluator's late counter and the lost-signal detector |
| `trips` | For each client, its `trip_live` row in progress on the vehicle at the frame time (departed, not ended); `v` trips before `ote`/`otr`, then the latest start. The evaluator gives each organization its own as `trip`, or `{"active": false}`; rules never read `trips` |
| `trip.age_min`, `trip.late_min` | Minutes from the trip start and from `estimated_arrival_time` to the frame time; `late_min` is negative before the estimated arrival |
| `trip.eta_deviation_min` | Predicted arrival minus `estimated_arrival_time`, in minutes; positive is late. Predicted arrival = frame time + the 75th percentile of the time past trips of the same origin and destination took from the frame's S2 level-12 cell to the destination (GPS database `s2cell_triproute_transition_stats`, rows for any start hour and any number of drivers). Missing without an estimated arrival, an origin, a destination or a position, and in a cell the route's past trips never crossed. Same value as the GPS database's `eta_diff_time` |
| `trip.current_zone_id` | `current_geofence_id`; 0 is left out |
| `trip.code` | The first service code of the trip |
| `trip.driver` | The organization's fleet driver with the trip's `driver_id` (tax id), an `active` one first. `registered` is false when the fleet has no such driver; left out when the trip has no driver. Fleet `inactive` reads `DEACTIVATED`. The tax id, name and phones never reach the signal |
| `derived.moving` | Frame speed above 10 km/h, as the GPS database's signal function; left out when the frame has no `gps` |
| `local_hour`, `local_minutes` | Frame time in `MIOT_SYMPTOMS_SIGNAL_BUILDER_ZONE` (default `America/Santiago`) |
| `geos` | For each client after a successful complete geofence load, where the frame's position is: `authorized_zone` inside a zone of type 0, `risk_zone` inside one of type 1, `outside_authorized` in no zone or inside one that is not of type 0 (even where an authorized one overlaps it), as the GPS database's signal function reads `properties.geofence_type`. A point on an edge is inside. A client with a known-empty set is outside every zone. A frame without a position, or an unavailable geofence source, gets none. The evaluator gives each organization its own as `geo`; rules never read `geos` |
| `derived.power_disconnected`, `derived.jamming` | One of the frame's `events` is of external power disconnected (`ALIMENTACION … DESCONECTADA`, `power … disconnect/cut`) or of GNSS/GSM jamming (`…jamm…`), `_` read as a space, ignoring case; false otherwise. "ALIMENTACION BATERIA" alone (running on battery) does not count |
| `roads` | For each client with a known limit at the position. `maxspeed_osm`: the `osm_roads_weight` road nearest the point within 0.0001° (about 11 m, planar degrees), a main road before a `_link`, then the nearer; its limit for a heavy vehicle (`spwgt38`), else `maxspeed`. No road near, or a nearest road without a limit, gives none. `osm_way_id` and `road_class` name that road. `maxspeed_custom`: the client's first zone (lowest id) that covers the point and, when the zone has a `heading`, matches the device heading (same quadrant or less than 90° apart). With `forward_from`/`forward_to` the bearing of travel (azimuth from the vehicle's previous position, kept per vehicle for 10 min) picks `speed_forward` or `speed_backward`; otherwise the zone has one limit. `custom_zone_id` names the zone. The evaluator gives each organization its own as `road`; rules never read `roads` |
| `vehicle`, `geo.zone`, `derived.speed_avg_5m` | Not built yet: left out. Until `vehicle` is built, `maxspeed_osm` is the heavy-vehicle limit |

Trips are loaded from the modulith database and shares (`asset_client_map`) geofences and the route history (`s2cell_triproute_transition_stats`) from the GPS database, at start and every `MIOT_SYMPTOMS_SIGNAL_BUILDER_RELOAD_EVERY` (10 min). A geofence change reaches the signals at the next load. Between loads, each change of a `trip_live` row sends a notice on the Postgres channel `miot_trips_live` (`{"tenant", "tripId"}`), and the builder reads that row again; shares follow their Debezium topic (a non-durable subscription, so a stopped replica leaves no backlog). Without a trips module the signal has no trips. Frames wait for the first load, which is retried until the databases answer. On wherever the symptoms Pulsar is wired (`MIOT_SYMPTOMS_CDC_ENABLED`, which follows the symptoms component); `MIOT_SYMPTOMS_SIGNAL_BUILDER_ENABLED=false` turns it off. Frames are counted (`miot.symptoms.signal.built`, `.skipped`), never logged.

Road limits are read by tiles of 0.02° (about 2 km): the first frame in a tile waits for one query of its ways, and the tile is kept for `MIOT_SYMPTOMS_SIGNAL_BUILDER_ROADS_TTL` (24 h). At most `MIOT_SYMPTOMS_SIGNAL_BUILDER_ROADS_MAX_TILES` (5,000) tiles are kept; the least recently read goes first. A tile that fails to load gives no road limit and is read again on the next frame in it. Gauges: `miot.symptoms.signal.road_tiles`, `.road_bytes`; counter `.road_tile_failures`. `MIOT_SYMPTOMS_SIGNAL_BUILDER_ROADS_ENABLED=false` turns road limits off. Speed limit zones are read in full with the other references.

Frames waiting for the same tile share its query, and empty tiles are cached too. Disconnected parts of a road stay separate when measuring distance. Invalid positions never trigger a road query. A custom zone with a heading filter requires a supplied, finite heading; an explicit 0° is valid. A missing bearing of travel gives no directional limit unless both directions have the same limit. Unknown limits remain absent from the signal.

## Rule editor fields

| Annotation | Field property |
|---|---|
| `title` | label |
| `x-unit` | unit |
| `x-origin` | origin; a part's origin applies to its fields |
| `x-type` | type, when the Java type is not enough (`zone`) |
| `x-engine: false` | the engine does not evaluate it yet |
| `hidden` | not a field |

A list rules read is declared in `SignalFields.LISTS` with the type of its elements (`GpsSignal.FrameEvent` for `signal.frame.events`). The list is a field of type `objects`; its element's fields are the paths under it, labelled by their `@Schema` titles.

Not fields: `signal.frame.asset_id` (same as `signal.asset_id`), driver data (read it from the trip), peripherals, metrics and other lists, and optional readings that gps-model exposes as primitives (`gps.altitude`, `gps.satellites`, `gps.accuracy`). A primitive reads 0 when the device did not send it, so a rule could not tell a missing reading from a zero one. The optional `gps.heading` is reserved for custom limit matching; its absence survives JSON transport, while the Java primitive getter retains its zero default for existing callers. `gps.speed` is a field anyway: a frame without speed reads 0, as a stopped vehicle.

To add a field: add it to `GpsSignal` (or to gps-model for frame fields) with its annotations. A frame field also needs a label in `gps-signal-labels.properties`; `SignalFieldsTest` fails until it has one.
