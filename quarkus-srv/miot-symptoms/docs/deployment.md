# Running the symptom engine on its own pods

The symptom engine can run as its own deployment with N replicas, beside the modulith that serves the API. Both use the same image (`miot-srv`) with a different environment.

| Deployment | Replicas | Runs |
| --- | --- | --- |
| `miot-modulith` (API pod) | 1 | Every component and the HTTP API. Takes device events. No signal builder, evaluator, SLA timer or lost-signal ticker. |
| `miot-symptoms-engine` | N | The symptoms component only: CDC dispatcher, signal builder, evaluator (with duty checks), lost-signal detector, SLA timer. HTTP serves `/q/*` only. |

The image is built with every component. `MIOT_COMPONENT_*_ENABLED` does not remove beans or endpoints at runtime. It starts the component's lifecycle, adds its Flyway locations and is the default of its jobs and Pulsar channels. The engine pod relies on these defaults.

## Environment

**API pod** (on top of its current environment):

| Variable | Value | Effect |
| --- | --- | --- |
| `MIOT_COMPONENT_ALL_ENABLED` | `true` | All components, API, jobs. |
| `MIOT_SYMPTOMS_CDC_ENABLED` | `false` | No CDC dispatcher. Signal builder, evaluator, lost-signal and SLA timer follow it and are off. |
| `MIOT_SYMPTOMS_PULSAR_ENABLED` | `true` | Device events endpoint publishes to the signals topic. |
| `MIOT_SYMPTOMS_EVALUATOR_REDIS_URL` | the engine's Redis | Map state, rule previews and event types read what the engine writes. |

Set `MIOT_SYMPTOMS_SIGNAL_BUILDER_ENABLED`, `MIOT_SYMPTOMS_EVALUATOR_ENABLED` and `MIOT_SYMPTOMS_SLA_ENABLED` to `false` too if they are set elsewhere in the environment: an explicit value wins over the CDC switch.

**Engine pod**:

| Variable | Value | Effect |
| --- | --- | --- |
| `MIOT_COMPONENT_ALL_ENABLED` | `false` | |
| `MIOT_COMPONENT_SYMPTOMS_ENABLED` | `true` | CDC dispatcher, Pulsar, signal builder, evaluator, lost-signal, SLA timer: all follow it. |
| `MIOT_API_ENABLED` | `false` | Every path outside `/q/` answers 404. Content cleanup and native membership migration are off. |
| `MIOT_CONVERSATIONAL_RULES_EVENTS_ENABLED` | `true` | Case events start their conversation runs. The API pod sends them. |
| `MIOT_SYMPTOMS_EVALUATOR_REDIS_URL` | required | Episodes, duty counters, lost-signal state and leases. Without it each replica keeps its own state in memory. |
| `MIOT_DB_*`, GPS and speed database, `PULSAR_URL` / `MIOT_SYMPTOMS_PULSAR_SERVICE_URL` | as the API pod | |
| `MIOT_SYMPTOMS_ROUTES_JSON` or `_FILE`, `MIOT_SYMPTOMS_ENGINE_*` | as the API pod had them | CDC dispatcher routes. |

Trips is not needed on the engine: the signal builder reads `miot_trips.trip_live` and `miot_fleet` with SQL and listens on `miot_trips_live`. The trips component on the API pod writes those rows and sends the notices.

`HOSTNAME` must differ per pod (Kubernetes sets it): the producer names use it.

## What each switch does with N replicas

| Part | Switch | Engine | API pod | With N replicas |
| --- | --- | --- | --- | --- |
| CDC dispatcher (`symptoms-cdc`) | `MIOT_SYMPTOMS_CDC_ENABLED` | on | off | Shared subscription `miot-symptoms-dispatcher`. Each route's bulkhead limit is per replica, so the total is N times the limit. |
| Device events (`device-signals`) | `MIOT_SYMPTOMS_PULSAR_ENABLED` | on (unused) | on | Producer `device-signals-$HOSTNAME`. Duplicate ids are refused in `miot_symptoms.device_event`, shared. 503 only where the switch is off. |
| Signal builder (`gps-frames` → `gps-signals`) | `MIOT_SYMPTOMS_SIGNAL_BUILDER_ENABLED` | on | off | Key_Shared `miot-signal-builder`, by vehicle. Producer `gps-signals-$HOSTNAME`. |
| Shares (`signal-asset-client-map`) | builder | on | off | Exclusive, non-durable, name `miot-signal-builder-refs-<uuid>`: one per replica, every replica reads every change. |
| Evaluator, duty checks (`gps-signals-in`) | `MIOT_SYMPTOMS_EVALUATOR_ENABLED` | on | off | Key_Shared `miot-symptom-evaluator`. Episodes and duty counters per vehicle in Redis. A replayed signal is rejected by its watermark. |
| Lost-signal detector and ticker | evaluator | on | off | Profiles and deadlines in Redis. One replica ticks: Redis lease. Coverage job: Redis lease `symptoms:coverage:lease`. |
| SLA timer | `MIOT_SYMPTOMS_SLA_ENABLED` | on | off | Every replica runs it. The expiry mark is written first; only the replica that writes it publishes. |
| Hold timer | `MIOT_SYMPTOMS_HOLDS_ENABLED` | on | on | A hold ends once; only the pod that ends it records it. |
| Stale case sweep (at start) | none | on | on | Database lock: the second pod finds nothing to close. |
| Device event pruning (6 h) | none | on | on | A `DELETE` of rows older than 30 days. |
| Driver contact sync | `MIOT_SYMPTOMS_DRIVER_SYNC_ENABLED` | off | on | Follows the fleet component. Advisory lock. |
| Trip geofences (`trip-gps-signals`) | `miot.trips.geofences.enabled` | off | on | Follows the trips component. Key_Shared `miot-trip-geofences`. Pending confirmations are in memory per pod. |
| ETA deviation (`route_etas`) | builder | on | off | Route cells loaded in each replica. |

Jobs of the other components follow their component flag, so they are off on the engine: modulith async-job worker, job console feed, Telnyx usage reconciler, harness thread purge, conversation rules scan, send-job repair, trip monitors clock, trip board feed. Content cleanup and native membership migration follow `MIOT_API_ENABLED`. The retransmit worker and the knowledge distiller are off unless set.

## Case events

The evaluator, SLA timer, hold timer and stale case sweep publish `symptom.case.*` events in process (CDI). The conversation rules engine stores each event and starts its runs (`MIOT_CONVERSATIONAL_RULES_EVENTS_ENABLED`). The rules scan (`MIOT_CONVERSATIONAL_RULES_ENABLED`) sends them; it runs on the API pod. Without the events switch on the engine, case events would start no conversation.

The engine does not migrate the conversational schema. If a release adds a conversational migration that event storage needs, deploy the API pod first; until it migrates, the engine logs a warning and those events start no run.

## State kept in memory per replica

When Pulsar moves a vehicle to another consumer (scale up or down, restart), the new consumer starts without these:

| State | Where | Effect of a move |
| --- | --- | --- |
| Last position per vehicle (bearing) | builder, 10 min | First signal after the move has no `bearing`. A vehicle that comes back to a replica within 10 min gets a bearing from its older position. |
| Trips, shares, zones, speed zones, route cells | builder | Every replica loads all of them at start and every 10 min, and follows `miot_trips_live` notices and the shares topic. Memory grows with the fleet, not with N. |
| Road tiles | builder, up to 5000 tiles, 24 h | Reloaded from the GPS database on first use. |
| Compiled symptom versions | evaluator, 30 s | Read again from the database. |
| Sample admission | evaluator, 15 s | Checked again in Redis. |

Key_Shared delivers a vehicle's signals to one consumer at a time and in order. While a consumer joins, Pulsar holds the moved keys until the earlier messages are acknowledged. A nacked signal is redelivered after later ones; the evaluator's watermark counts it as late (`miot.symptoms.evaluator.late`).

## Start-up and migrations

- The engine starts with `MIOT_COMPONENT_ALL_ENABLED=false`: every bean is in the image, so no bean is missing.
- `FlywayMigrator` runs on every pod with a database component. The engine migrates `core` and `symptoms`; the API pod migrates all. Concurrent pods are safe: Flyway holds a Postgres advisory lock while migrating, and the symptoms migrations reference no other component's schema. `MIOT_FLYWAY_ENABLED=false` skips it on a pod. `QUARKUS_FLYWAY_MIGRATE_AT_START` does not control `FlywayMigrator`.
- The start log lists the engine parts on the pod: `Symptoms component started — … on this pod: cdc-dispatcher,device-events,signal-builder,evaluator,lost-signal,sla-timer`.

## Health

| Path | Engine content |
| --- | --- |
| `/q/health/live` | Pulsar channels (SmallRye Messaging), down when a consumer or producer fails. |
| `/q/health/ready` | Pulsar channels, datasources, `miot-components` with `symptoms` (`parts`, `routes`, `gps`), native membership (up: the migration is off). |
| `/q/metrics` | `miot.symptoms.signal.*`, `miot.symptoms.evaluator.*`, lost-signal and SLA counters. |
