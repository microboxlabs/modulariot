# P0 Spike — variable propagation + feature-flag source

> Rung P0 of `calendar-task-driven-frontend-GOAL-LADDER.md`. Decision /
> spike document only — no production code is touched in this rung. Two
> decisions pinned here: (i) the concrete contract that the ECM
> companion issue **`ecm-coordinator#262`** must implement so the
> assign-resource tuple reaches the ECM workflow as **process**
> variables on the `assignDriver → presentDriver` move; (ii) the
> per-origin "task-driven" feature-flag source the frontend will read
> in Phase 1.
>
> Base SHA: `f9babf5b9bffb11070c5be377293c1a3132a5264` (`docs(517): add
> task-driven planner plan + goal ladder`).

---

## 1. Today's flow — what the frontend already sends

The assign tuple already exists on the frontend as a stable, named set
of fields, but it rides the `cld_bookings.resource_data` blob into a
direct `POST /mintral/calendar/binding` call. The task move that flips
`assignDriver → presentDriver` carries **nothing** beyond `taskId` and
`transition`.

### 1.1 Where the tuple is constructed today

`extractCalendarBindingPayload` reads the seven assign fields off the
booking's `resource.data` and lifts them into the snake_case ECM
binding payload:

```
turbo-repo/apps/app/src/app/api/calendar/bookings/binding-extractor.ts
  41  const carrierId = readString(data, "assignedCarrier");
  42  const driverId  = readString(data, "assignedDriver");
  43  const truckId   = readString(data, "assignedTruck");
  44  const isAssignment = Boolean(carrierId && driverId && truckId);
  ...
  54    const serviceKindRaw = readString(data, "mintral_serviceKind");
  60      return { ...payload, stage: "planned" };
  61    payload.tipo_servicio = serviceKindRaw.toUpperCase();
  62    payload.carrier_id = carrierId;
  63    payload.driver_id  = driverId;
  64    payload.truck_id   = truckId;
  65    payload.driver2_id = readString(data, "assignedDriver2") || null;
  66    payload.trailer_id = readString(data, "assignedTrailer") || null;
  70    payload.carrier_external_id = readNullableString(
  71      data, "assignedCarrierExternalId"
  72    );
```

The wire shape that ECM already consumes today (snake_case, exact field
set — `numero_servicio`, `calendar_id`, `stage`, `tipo_servicio`,
`carrier_id`, `driver_id`, `driver2_id`, `truck_id`, `trailer_id`,
`carrier_external_id`):

```
turbo-repo/apps/app/src/features/common/providers/alfresco-api/alfresco-api.provider.ts
 270  export interface CalendarBindingPayload {
 271    numero_servicio: string;
 272    calendar_id: string;
 273    stage: CalendarBindingStage;
 274    tipo_servicio?: string;
 275    carrier_id?: string;
 276    driver_id?: string;
 277    driver2_id?: string | null;
 278    truck_id?: string;
 279    trailer_id?: string | null;
 ...
 288    carrier_external_id?: string | null;
 289  }
```

### 1.2 Where the task move happens — and what it carries

The `EndTaskWebscript` is called via the `endTask` provider as a plain
**GET** that passes only `taskId` and `transition`:

```
turbo-repo/apps/app/src/features/common/providers/alfresco-api/alfresco-api.provider.ts
 235  export async function endTask(
 236    session: Session,
 237    taskId: string,
 238    transitionId?: string
 239  ): Promise<EndTaskResponse> {
 240    const queryParams = new URLSearchParams({ taskId });
 241    ...
 246    const baseUrl = `${process.env.ECM_API_URL}/alfresco/s/mintral/tasks/end?${queryParams.toString()}`;
 248    const result = await fetcher(url, { method: "GET", headers });
```

There is an existing precedent in this codebase for "carry extra fields
across a task move": the kanban task-form BFF does an `updateTask`
**before** the `endTask`, writing form props as task-local Alfresco
properties:

```
turbo-repo/apps/app/src/app/api/task/end/route.ts
 197  export async function POST(request: NextRequest) {
 ...
 205    const updateTaskPayload = buildUpdateTaskPayload(json, session.user.email);
 208    await updateTask(session, "activiti$" + json.taskId, updateTaskPayload);
 210    const response = await endTask(session, json.taskId, json.transitionId);
```

This pattern is **task-scope only** — fields land on the current
`assignDriver` task. The plan (Phase 3, §4.4) is explicit that task-
local variables do not survive into the next task and therefore can't
be read by `OnCreatePresentDriverBinding` (the listener that fires on
`presentDriver` create). The companion contract below addresses that.

### 1.3 The planner's task-advance call (no tuple today)

`confirmService` resolves the live task and builds a `BookingTaskAdvance`
containing **only** `{ taskId, transitionId }`:

```
turbo-repo/apps/app/src/features/calendar/components/planning/planning-selection-context.tsx
1762  const transitionId = wasReassigning
1763    ? undefined
1764    : getNextTransition(liveTask?.stage);
1765  const taskAdvance: BookingTaskAdvance | undefined =
1766    transitionId && liveTask?.taskId
1767      ? { taskId: liveTask.taskId, transitionId }
1768      : undefined;
1769
1770  await persistPlannedBooking({
1771    calendarId,
1772    service: effectiveService,
1773    slot: slotToUse,
1774    ...
1777    taskAdvance,
```

…and `persistPlannedBooking` fires that as a bare
`advanceWorkflowTask(taskId, transitionId)`:

```
turbo-repo/apps/app/src/features/calendar/components/planning/planning-selection-context.tsx
 853    if (taskAdvance) {
 854      await advanceWorkflowTask(taskAdvance.taskId, taskAdvance.transitionId);
 855    }
```

The forward transition that needs the tuple — `assignDriver →
presentDriver`, mapped by `NEXT_TRANSITION`:

```
turbo-repo/apps/app/src/features/calendar/services/task-stage-transitions.ts
  13  const NEXT_TRANSITION: Partial<Record<TaskStage, string>> = {
  14    planService: "Asignar Conductor/Transporte",
  15    assignDriver: "Presentar Conductor",
  16  };
```

## 2. Decision (i) — contract for `ecm-coordinator#262`

### 2.1 Statement

**The frontend will carry the assign tuple by passing a `processVariables`
JSON body on the `endTask` call for the `assignDriver → presentDriver`
move. `ecm-coordinator#262` extends `EndTaskWebscript` to accept that
body and set those variables on the workflow's PROCESS scope before
completing the task.**

Rationale (vs. the two other options listed in `calendar-task-driven-
frontend.md` §4.4):

- The "FE's separate `updateTask`" path (option b) writes task-local
  variables on `assignDriver` (see `task/end/route.ts:208` above). They
  do not survive into `presentDriver`, so the listener still finds
  nothing — same defect the binding-call removal is trying to fix.
  Rejected.
- An `OnCompleteAssignDriverTask` listener that promotes task-local →
  process (option c) requires the FE *and* a BPMN-adjacent listener to
  stay coordinated, and still depends on a separate `updateTask` round-
  trip. Rejected as redundant: the `EndTaskWebscript` is already the
  single entry point for completing tasks; threading PROCESS vars
  through it is the one move that makes the binding path go away
  cleanly.

### 2.2 Wire contract — what the frontend will send

The webscript moves from **GET → POST** for the `assignDriver →
presentDriver` transition (existing GET callers are still supported).
Body is JSON; the variable keys are the same snake_case keys the
binding payload already uses today (§1.1) so the field set is already
proven and ECM can copy the listener's read pattern verbatim:

```
POST /alfresco/s/mintral/tasks/end?taskId=<id>&transition=Presentar%20Conductor
Content-Type: application/json

{
  "processVariables": {
    "carrier_id":           "<uuid>",
    "driver_id":            "<uuid>",
    "driver2_id":           "<uuid>|null",
    "truck_id":             "<uuid>",
    "trailer_id":           "<uuid>|null",
    "carrier_external_id":  "<prve_codigo>|null",
    "tipo_servicio":        "<UPPERCASED kind>"
  }
}
```

Required (must be non-empty strings on this move):
`carrier_id`, `driver_id`, `truck_id`, `tipo_servicio`.
Nullable (string or JSON `null`): `driver2_id`, `trailer_id`,
`carrier_external_id`.

These mirror the **assigned**-stage field set in
`binding-extractor.ts:62–73` and `alfresco-api.provider.ts:270–289` —
no new fields are introduced; the spike's only structural change is
*where* the tuple travels.

### 2.3 What `ecm-coordinator#262` MUST implement (the ECM side of the contract)

1. **Accept `POST` with a JSON body on `EndTaskWebscript`** in addition
   to today's GET. Validation:
   - `taskId` and `transition` remain query params, unchanged.
   - `processVariables` is an optional top-level JSON object; when
     present, every key must be a JSON string or JSON `null`.
   - Reject unknown keys (defense-in-depth — the FE will only ever
     send the seven keys listed in §2.2; an unknown key indicates a
     contract drift).
2. **Set `processVariables` on the workflow's PROCESS scope** for the
   task's `executionId` **before** completing the task, so the new
   `presentDriver` task is created with the variables already visible
   on the process. Task-local scope is not acceptable — that is the
   exact failure mode this contract eliminates.
3. **`OnCreatePresentDriverBinding` reads the tuple from process
   scope** (instead of via the now-removed binding webscript) and
   pushes to Alerce / records the binding as `assigned`. The variable
   names listed in §2.2 are the read keys.
4. **Backward compatibility**: the GET form (no body) keeps working
   for every other transition and for un-migrated origins (flag-off
   path). Only the `Presentar Conductor` transition reads
   `processVariables`; other transitions ignore the body even if sent.
5. **Auth and tenancy**: the request is already authenticated via the
   planner's ticket/JWT (see `prepareAlfrescoAuth` in
   `alfresco-api.provider.ts:246-247`); no new auth surface is
   introduced.

### 2.4 What the frontend will do in Phase 3 (sketched here, not built)

When the flag is on for the origin, the planner builds a
`processVariables` object from `effectiveService` and threads it
through `BookingTaskAdvance` so `advanceWorkflowTask` can POST it on
the `Presentar Conductor` move. The exact field mapping the FE will
use (left = process-variable key on the wire; right = field on
`SelectedService` / booking `resource.data`):

| process variable      | source on `SelectedService`            | nullable? |
|-----------------------|----------------------------------------|-----------|
| `carrier_id`          | `assignedCarrier`                      | no        |
| `driver_id`           | `assignedDriver`                       | no        |
| `driver2_id`          | `assignedDriver2`                      | yes       |
| `truck_id`            | `assignedTruck`                        | no        |
| `trailer_id`          | `assignedTrailer`                      | yes       |
| `carrier_external_id` | `assignedCarrierExternalId`            | yes       |
| `tipo_servicio`       | `mintral_serviceKind` (uppercased)     | no        |

The "all four required non-empty" gate is the same one the planner
already uses to gate the Asignar button and to switch the binding
stage from `planned` to `assigned`
(`binding-extractor.ts:44`) — no new client-side validation surface
is needed.

## 3. Decision (ii) — per-origin feature-flag source

### 3.1 Statement

**The frontend will read the per-origin task-driven flag from a single
`NEXT_PUBLIC_TASK_DRIVEN_ORIGINS` Next.js public env var — a comma-
separated list of origin codes that are task-driven. The match key is
the service / task's `mintral_originDelegateCode`. Default is empty —
every origin off until explicitly enabled.**

### 3.2 Rationale

- **Origin is already known per-service** with no new lookup. The
  exact field is present on the task and is already read across the
  codebase:

  ```
  turbo-repo/apps/app/src/features/shipping/services/data.service.ts
  58  const origin = task.mintral_originDelegateCode as string;

  turbo-repo/apps/app/src/features/task-forms/components/task-form/task-form.types.ts
  25  mintral_originDelegateCode: string;
  ```

  The planner already passes the service through `confirmService` /
  `removeService` paths; the helper added in P1 only needs to read
  this string and check membership.

- **Cheapest valid source.** A `NEXT_PUBLIC_…` env var is the existing
  pattern in this app for client-side booleans / lists (see
  `huella.tsx:122` for the boolean precedent: `process.env.
  NEXT_PUBLIC_SIMULATE_AUTENTIA === "true"`). No new API endpoint, no
  new ECM read, no new caching layer.

- **Mirrors the ECM-side per-origin gate.** The plan calls out
  `mintral.calendar.<origin>.defaultId` (an ECM Java system property
  keyed by origin code) as the rollout template. The frontend's
  `NEXT_PUBLIC_TASK_DRIVEN_ORIGINS=ANTOFAGASTA,CALAMA` is the symmetric
  rollout knob, just on the deploy side. A misalignment between the
  two does not corrupt data: the worst case during transition is
  double-binding (today's behavior) or zero-binding (rolled back) for
  the affected origin — both are recoverable by editing the env list
  and redeploying.

- **Default off is structural, not policy.** An unset / empty env
  var is parsed as the empty origin set, so the helper returns `false`
  for every origin — including unknown ones. There is no "unknown
  origin defaults to task-driven" failure mode.

### 3.3 Rejected alternatives

- **A `taskDriven: boolean` field on the miot-calendar `Calendar`
  resource.** The calendar already carries a `filter.origin`
  (`turbo-repo/apps/app/src/app/api/calendar/route.ts:10-15`), so on
  paper it could host a `taskDriven` boolean. Rejected for P0: it
  requires a schema migration on a package the frontend doesn't own
  (miot-calendar), couples the rollout knob to per-calendar data
  rather than per-origin, and is strictly heavier than an env var.
  Worth revisiting once every origin has migrated and the env var
  becomes redundant.
- **A new BFF endpoint reading ECM `mintral.calendar.<origin>.defaultId`.**
  Adds a network hop and a caching question on every planner page
  load for what is fundamentally a static deploy-time list. Rejected.
- **Reading a derived list off `useCalendars()`.** Origin lives on
  the **task**, not the calendar binding; a service has one origin
  whether or not it's in a calendar yet. Origin-keyed via the env
  list is the correct cardinality.

### 3.4 What P1 must do (sketched here, not built)

- A small typed helper under `turbo-repo/apps/app/src/features/calendar/`
  (per the ladder's P1 contract — no barrel/`index.ts`) that:
  - parses `process.env.NEXT_PUBLIC_TASK_DRIVEN_ORIGINS` once, trims
    each entry, ignores empty entries, comparison case-sensitive;
  - exposes `isOriginTaskDriven(origin: string | undefined): boolean`
    returning `false` for `undefined` / empty / non-listed origins;
  - has unit tests for: flag-on origin, flag-off origin, unknown
    origin, empty env, env with whitespace / empty entries.
- **No call site reads the flag in P1** — P2 and P3 are the rungs
  that wire it into the plan/assign paths.

## 4. Out of scope for P0

- Writing the helper itself, or any production code (Phase 1+).
- Filing `ecm-coordinator#262` (separate repo; constraint of this
  rung is "do not touch the ecm-coordinator repo"). §2.3 is the
  spec that issue will reference.
- Removing the `/mintral/calendar/binding` HTTP path from the
  frontend (follow-up after every origin migrates — see plan §5
  "Follow-up").
