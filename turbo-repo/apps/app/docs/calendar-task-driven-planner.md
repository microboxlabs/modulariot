# Calendar — Task-driven planner

> Feature reference for the calendar planner's **task-driven** mode
> (modulariot #517). Companion to:
> - `docs/plans/calendar-task-driven-frontend.md` — design rationale.
> - `docs/plans/calendar-task-driven-frontend-P0-spike.md` — wire
>   contract for ECM (`ecm-coordinator#262`) and rollout-flag rationale.

## 1. What is "task-driven"?

The calendar planner has two operating modes per service origin, gated
by the **`TASK_DRIVEN_ORIGINS`** env var, exposed to the client via the
runtime-config provider (see §4):

- **Flag OFF (legacy)** — the frontend writes the miot-calendar booking
  **and** explicitly calls the ECM calendar-binding webscript
  (`/mintral/calendar/binding`) **and** moves the workflow task. Three
  writes, kept in sync by the BFF.
- **Flag ON (task-driven)** — the frontend writes the miot-calendar
  booking **and** moves the workflow task. ECM task listeners
  (`OnCreateAssignDriverBinding`, `OnCreatePresentDriverBinding`,
  `OnCreateUnplannedBinding`) reconcile the calendar binding off the
  task move alone. The frontend never calls
  `/mintral/calendar/binding` for these origins.

The two modes coexist during rollout: each origin migrates independently
by being added to the env list.

## 2. What changes per operation (flag-on vs flag-off)

| Operation | Frontend (flag-off, legacy)                                                                                  | Frontend (flag-on, task-driven)                                                                                              | ECM listener (flag-on)                                  |
|-----------|--------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------|
| Plan      | write booking → call binding (`stage=planned`) → move `planService → assignDriver`                            | write booking → move `planService → assignDriver`                                                                            | `OnCreateAssignDriverBinding` → `markUnassigned`        |
| Unplan    | move task back → cancel booking → call binding (`stage=none`)                                                 | move task back → cancel booking                                                                                              | `OnCreateUnplannedBinding` → `markNone`                 |
| Assign    | write booking → call binding (`stage=assigned`, full tuple) → move `assignDriver → presentDriver` (GET, no body) | write booking → move `assignDriver → presentDriver` **POST** with `processVariables` body carrying the resource tuple        | `OnCreatePresentDriverBinding` → `markAssigned` + Alerce push |
| Unassign  | move `presentDriver → assignDriver` via `Asignar Conductor/Transporte` → drop tuple from booking → call binding (`stage=unassigned`) | move `presentDriver → assignDriver` via `Asignar Conductor/Transporte` → drop tuple from booking                              | `OnCreateAssignDriverBinding` → `markUnassigned`        |

The miot-calendar booking write is the same call in both modes — only
the ECM binding webscript is dropped. The BPMN transition names
(`Asignar Conductor/Transporte`, `Presentar Conductor`, etc.) are
identical too; what changes is what rides on the assign move.

## 3. Wire shape — `assignDriver → presentDriver` task advance

The legacy GET form is still supported and is what every flag-off
origin (and every transition other than the assign move) uses. The
task-driven assign move switches to **POST with a JSON body** that
carries the resource tuple as **process-scope** variables. ECM sets
those on the workflow's PROCESS scope **before** completing the task,
so the just-created `presentDriver` task sees them and
`OnCreatePresentDriverBinding` can push to Alerce.

### Legacy GET (every flag-off move, and every flag-on move that isn't `Presentar Conductor`)

```
GET /alfresco/s/mintral/tasks/end?taskId=<id>&transition=<name>
Authorization: <ticket or JWT>
```

No body. ECM completes the task and runs whatever listeners are wired
to the BPMN.

### Task-driven assign — POST with `processVariables`

The frontend BFF (`/app/api/task/end`) accepts the same POST body the
client builds and forwards it verbatim to the ECM webscript:

```
POST /alfresco/s/mintral/tasks/end?taskId=<id>&transition=Presentar%20Conductor
Authorization: <ticket or JWT>
Content-Type: application/json

{
  "processVariables": {
    "carrier_id":           "<uuid>",
    "driver_id":            "<uuid>",
    "driver2_id":           "<uuid> | null",
    "truck_id":             "<uuid>",
    "trailer_id":           "<uuid> | null",
    "carrier_external_id":  "<prve_codigo> | null",
    "tipo_servicio":        "<UPPERCASED service kind>"
  }
}
```

**Field rules** (enforced by `buildAssignProcessVariables` in
`src/features/calendar/services/task-driven-assign.ts`):

| Key                   | Type            | Source (`SelectedService`)            | Required? |
|-----------------------|-----------------|---------------------------------------|-----------|
| `carrier_id`          | string          | `assignedCarrier`                     | yes       |
| `driver_id`           | string          | `assignedDriver`                      | yes       |
| `driver2_id`          | string \| null  | `assignedDriver2`                     | nullable  |
| `truck_id`            | string          | `assignedTruck`                       | yes       |
| `trailer_id`          | string \| null  | `assignedTrailer`                     | nullable  |
| `carrier_external_id` | string \| null  | `assignedCarrierExternalId`           | nullable  |
| `tipo_servicio`       | string (UPPER)  | `mintral_serviceKind` (uppercased)    | yes       |

If any required field is missing the helper returns `null` and the
caller falls back to a plain GET — matching the planner's existing
"Asignar"-button enable rule, which only triggers an assign with the
full tuple set.

### Same body shape, three layers

The same JSON payload threads through three call sites unchanged:

1. **Client** — `advanceWorkflowTask(taskId, transitionId, processVariables?)`
   in `src/features/common/providers/client-api.provider.ts` — POSTs to
   the BFF when `processVariables` is present, GETs otherwise.
2. **BFF** — `POST /app/api/task/end` in
   `src/app/api/task/end/route.ts` — when `processVariables` is in the
   request body, forwards to `endTask(... , processVariables)` and
   skips the kanban `updateTask` step (the resource tuple is the
   entire payload, there are no form fields to write).
3. **ECM provider** — `endTask(... , processVariables?)` in
   `src/features/common/providers/alfresco-api/alfresco-api.provider.ts`
   — switches to POST + JSON body when `processVariables` is present,
   GETs otherwise.

The bookings BFF (`/app/api/calendar/bookings`) also threads
`processVariables` through `BookingTaskAdvance` when the assign rides
on a booking write — same wire shape.

## 4. Per-origin rollout flag — `TASK_DRIVEN_ORIGINS`

### Shape

A **server-side** env var, mirrored to the client through the runtime
config provider. The server route `/app/api/runtime-config` reads
`process.env.TASK_DRIVEN_ORIGINS` per request (`force-dynamic`, 5 min
public cache) and the client picks it up via `useRuntimeConfig()`.
**No `NEXT_PUBLIC_` prefix and no rebuild required to flip an origin**
— update the deploy env and the next page load picks up the new value
(plus a cache-busting hard refresh during the 5 min TTL window).

Value is a **comma-separated list of origin codes** — specifically
`mintral_originDelegateCode` values matched against the service's
`origen` field. Whitespace around entries is trimmed; empty entries
are ignored; matching is **case-sensitive**.

Examples:

```env
# Roll out two origins
TASK_DRIVEN_ORIGINS=ANTOFAGASTA,CALAMA

# Empty / unset → no origin is task-driven (default; legacy behavior)
TASK_DRIVEN_ORIGINS=
```

### Reading the flag

The helpers are pure — they take the enabled-origins set explicitly.
React components consume the set via `useTaskDrivenOrigins()`, which
parses the runtime-config string once and memoizes the `Set`:

```ts
import { useTaskDrivenOrigins } from "@/features/calendar/services/use-task-driven-origins";
import { isOriginTaskDriven } from "@/features/calendar/services/task-driven-origin";

// Inside a React component (or a hook):
const enabled = useTaskDrivenOrigins();
isOriginTaskDriven("ANTOFAGASTA", enabled); // → true if listed
isOriginTaskDriven("UNKNOWN", enabled);     // → false
isOriginTaskDriven(undefined, enabled);     // → false
```

For **server-side** code (BFF routes), parse the env directly per
request — the route handlers are `force-dynamic` so `process.env`
reads are fresh:

```ts
import {
  isOriginTaskDriven,
  parseTaskDrivenOrigins,
} from "@/features/calendar/services/task-driven-origin";

const enabled = parseTaskDrivenOrigins(process.env.TASK_DRIVEN_ORIGINS);
if (isOriginTaskDriven(originCode, enabled)) { /* skip legacy binding */ }
```

Default-off is structural: every code path that branches on the flag
returns the legacy decision (call the binding, GET the task move) when
`isOriginTaskDriven` returns `false`, so an empty env list is
byte-for-byte today's behavior. The runtime-config fetch is async —
during the few-ms window before it resolves the set is empty, which
is also the safe (legacy) decision.

### Call sites (decision helpers, not direct flag reads)

The planner does not read `isOriginTaskDriven` directly; five decision
helpers wrap it so the planner stays declarative. Each takes the
enabled-origins set as its trailing argument:

- `decidePlanTaskAdvance(transitionId, origin, calendarId, slot, enabled)` —
  `src/features/calendar/services/task-driven-plan.ts`. Returns the
  slot `processVariables` payload when the transition is
  `"Asignar Conductor/Transporte"` AND the origin is task-driven AND
  `calendarId` is set; `null` otherwise. Presence signals
  `persistPlannedBooking` to SKIP the BFF booking POST — ECM's
  `OnCreateAssignDriverBinding` writes the row itself
  (ecm-coordinator#266).
- `decideAssignTaskAdvance(transitionId, origin, service, enabled)` —
  `src/features/calendar/services/task-driven-assign.ts`. Returns the
  resource `processVariables` payload **only** when the transition is
  `"Presentar Conductor"` AND the origin is task-driven AND the full
  tuple is present; `null` everywhere else (PLAN moves, flag-off,
  incomplete tuple) → plain GET advance.
- `decideUnplanBindingNotification(numeroServicio, calendarId, origin, enabled)` —
  `src/features/calendar/services/task-driven-binding-gate.ts`.
  Returns the `stage="none"` `notifyCalendarBinding` payload to send
  on UNPLAN, or `null` when the call must be skipped (task-driven
  origin, missing `numeroServicio`, missing `calendarId`).
- `decideUnassignBindingNotification(numeroServicio, calendarId, origin, enabled)` —
  same file, sibling of the unplan helper. Returns the
  `stage="unassigned"` `notifyCalendarBinding` payload to send on
  UNASSIGN, or `null` when the call must be skipped.
- `getTaskDrivenUnassignTransition(stage, origin, enabled)` — same
  file as `decideAssignTaskAdvance`. Returns `"Asignar Conductor/Transporte"`
  when origin is task-driven AND stage is `presentDriver`; `undefined`
  otherwise → planner falls through to the legacy `getUnassignTransition`
  map.

The bookings BFF (`src/app/api/calendar/bookings/route.ts`) parses the
env directly per request and calls `isOriginTaskDriven` to short-circuit
the `extractCalendarBindingPayload` + `runCalendarBinding` block — that
gate is server-side and has no helper because there's only one
condition (origin in the env list).

## 5. Enabling an origin in the deploy

`TASK_DRIVEN_ORIGINS` is read **at request time** by the server, not
inlined into the client bundle. Flipping an origin takes effect on the
next request once the runtime-config cache invalidates (5 min) — **no
rebuild required**.

1. **Pick the origin code.** The match key is the service's
   `mintral_originDelegateCode` value (uppercase ASCII, e.g.
   `ANTOFAGASTA`, `CALAMA`). Confirm the exact string by looking at
   the kanban for a representative service.
2. **Confirm ECM is ready for that origin.** The companion
   `mintral.calendar.<origin>.defaultId` Java property must be set on
   ECM for the same origin — otherwise the listener has no calendar
   to bind against and the assign move silently does not push to
   Alerce. (See `calendar-task-driven-frontend.md` §2 for the
   per-origin coupling rationale.)
3. **Add the code to `TASK_DRIVEN_ORIGINS`** in the deploy environment
   — wherever this app's env is configured (Kubernetes ConfigMap,
   Docker compose file, `.env.local` for local dev). It's a
   comma-separated list, so to migrate a second origin append:
   `ANTOFAGASTA` → `ANTOFAGASTA,CALAMA`.
4. **Reload the pod / restart the dev server.** A pod restart picks
   up the new env immediately; clients will see the new value on
   their next `/app/api/runtime-config` fetch (max 5 min stale via
   the route's `s-maxage`).
5. **Verify** with the recipe in
   `docs/plans/calendar-task-driven-frontend-P4-validation.md`
   (plan/assign/unplan/unassign on a service in the migrated origin).

### Rolling back an origin

Remove the code from the env list and redeploy. The decision helpers
will return their legacy values again — the binding call comes back,
the assign move goes back to GET. No data migration; the worst case
during a roll-forward / roll-back swap is a single double-bind or
zero-bind for a single service (idempotent on ECM's side, recoverable
by re-running the planner action).

## 6. Reference — file map

| Concern                                | File                                                                                       |
|----------------------------------------|--------------------------------------------------------------------------------------------|
| Origin rollout flag helper (pure)      | `src/features/calendar/services/task-driven-origin.ts`                                     |
| Runtime-config → enabled set bridge    | `src/features/calendar/services/use-task-driven-origins.ts`                                |
| Plan process-variables builder         | `src/features/calendar/services/task-driven-plan.ts`                                       |
| Assign process-variables builder       | `src/features/calendar/services/task-driven-assign.ts` (`buildAssignProcessVariables`)     |
| Plan / assign / unassign decision helpers | `src/features/calendar/services/task-driven-{plan,assign}.ts`                            |
| Unplan / unassign binding-call gates   | `src/features/calendar/services/task-driven-binding-gate.ts`                               |
| Runtime-config types + whitelist       | `src/features/runtime-config/runtime-config.{types,constants}.ts`                          |
| Planner wiring (plan/assign/unplan/unassign) | `src/features/calendar/components/planning/planning-selection-context.tsx`           |
| Bookings BFF (per-origin binding gate) | `src/app/api/calendar/bookings/route.ts`                                                   |
| Task-end BFF (POST `processVariables`) | `src/app/api/task/end/route.ts` (line 212)                                                 |
| ECM provider `endTask` (POST shape)    | `src/features/common/providers/alfresco-api/alfresco-api.provider.ts` (line 256)           |
| Client `advanceWorkflowTask`           | `src/features/common/providers/client-api.provider.ts` (line 1790)                         |
| Legacy `getUnassignTransition` map     | `src/features/calendar/services/task-stage-transitions.ts`                                 |

Unit tests live next to each helper (`*.test.ts` siblings).
