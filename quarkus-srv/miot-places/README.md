# Places sync to StreamHub

Outside the `dev` profile, sync defaults to `miot.component.places.enabled`. Components default to off;
the all-components API pod owns places, while the symptoms-only engine does not sync even though its
image contains the places beans. `MIOT_PLACES_SYNC_ENABLED=false` disables sync, and `true` explicitly
enables it in dev. Both the places component and a configured writable `gps` datasource are required.
Without GPS, startup logs that sync is skipped and places remain pending.

The organization access filter resolves the organization's `tenant_client_id` into the place's
`tenant_code`, which is used as GPS `client_id`. The immutable, case-sensitive external code maps to
`client_geofence_id`. Sub-accounts sharing their parent's GPS client are refused by the places API.
GPS needs a unique constraint on `(client_id, client_geofence_id)` for idempotent upserts.

The organization and code are the key. Sync writes the row with them whoever created it, so a geofence
imported into Places (`places-import-from-gps.sh`) keeps syncing to its own GPS row, and each write marks
the row with the reserved GPS JSON properties `created_by=miot-places` and `miot_place_id=<source UUID>`.
The one exception is a miot-trips location geofence (`created_by=miot-trips`): it is never replaced or
removed, and the place stays pending with a warning. The first write replaces the row's name, shape and
properties with the place's, so a property the place lacks is dropped from the row. A delete removes the
row of the organization and code unless it is a trips location or carries another place's UUID, so an old
delete cannot remove a newer place that reused the code. Routes are never copied.

API writes commit locally before sync. A transaction-scoped advisory lock on the places database
admits one writer across API calls, retry jobs and replicas. A busy writer leaves changes pending.
The pool needs at least two connections: one pins the lock and the other reads/acknowledges places.
Retry starts after one minute, processes up to 200 entries, deletes first, and runs every five minutes
(`MIOT_PLACES_SYNC_RETRY_EVERY`, `off` disables the job). Failed rows stay pending for the next interval;
there is no immediate retry loop or exponential backoff. Each GPS operation has a ten-second timeout.
Failures are logged per place and successful retry batches log their count; no dedicated sync metrics
are currently exposed. A failed copy does not prevent later entries in its batch from being attempted.

Before enabling in a deployment, an administrator must verify the GPS login has schema `USAGE`,
`SELECT`, `INSERT`, `UPDATE` and `DELETE` on the target `geofences` table, plus `USAGE` on its generated-ID
sequence if applicable. Both databases require PostGIS; provision that extension separately.
Use the writable `gps` pool; `gps-read` sessions are read only. This change does not provision grants
or deploy anything. Disable sync in any additional environment that points at a
shared GPS database and is not intended to own its places.

Run the places and CLI reactor tests from `quarkus-srv` with
`./mvnw -pl miot-places,miot-cli -am test`. Set `-Dmiot.places.test.pg-url=<scratch PostgreSQL URI>`
to include the real database tests; the geospatial tests require PostGIS in that isolated database.
Never point these tests at a shared database.
