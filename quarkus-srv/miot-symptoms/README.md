# miot-symptoms

In-process symptoms dispatcher for the ModularIoT modulith. Replaces one
`prod-streamhub-apis-miot-symptoms-*` Autopilot pod per `rule_id` with a
`RouteTable` inside this process.

This is **not** a detector. Heavy work stays in Postgres `process_symptoms_*`
and (optionally) n8n / `router.streamhub.cl`.

## Pipeline

```
accumulated_states INSERT/UPDATE
  → Debezium → Pulsar
  → @Incoming("symptoms-cdc")  (Shared, Latest, quarkus-messaging-pulsar)
  → RouteTable.match(rule_id)
  → optional SELECT process_symptoms_*(jsonb)
  → optional HTTP POST (skip if forward=false or status=204)
```

`RouteTable` is loaded from JSON today (`miot.symptoms.routes-json` or
`miot.symptoms.routes-file`). Superadmin settings will implement
`RouteTableSource` later; the table shape stays the same.

## Cutover (one rule at a time)

A `rule_id` has **exactly one** owner: this dispatcher **or** the old Helm
pod. Never both Ready.

1. Add the route to the JSON (example: `src/main/resources/symptoms-routes.example.json`).
2. Confirm the old `fwd-n8n` exclude list still contains that id (static union
   of every dedicated id, including ones this process now owns).
3. Take the old Deployment down (`enabled: false` on that `symptoms[]` row).
4. Then start / reload this component so Latest is *now*.

Rollback: remove the route, seek/recreate the old subscription at Latest,
re-enable the old pod. Do not resume the abandoned cursor.

## Enable

```bash
./start.sh symptoms
# or
MIOT_COMPONENT_SYMPTOMS_ENABLED=true
MIOT_SYMPTOMS_GPS_REACTIVE_URL=postgresql://host:5432/prod_iot_gps
MIOT_SYMPTOMS_GPS_USERNAME=...
MIOT_SYMPTOMS_GPS_PASSWORD=...
MIOT_SYMPTOMS_ROUTES_FILE=/config/symptoms-routes.json
```

The channel is off unless `miot.component.symptoms.enabled=true`. An empty
RouteTable still subscribes (Latest) and **acks/skips** unowned `rule_id`s —
old Helm pods keep those rules. Do not add a route until the old pod is down.

`subscription-initial-position` must stay `Latest`.
