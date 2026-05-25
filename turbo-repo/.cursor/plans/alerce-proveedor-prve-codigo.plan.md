# Plan — Source Alerce `proveedor` from the carrier select's `external_id`

## Context

`ams.fn_rd_accredited_resources` (Erick, backend) now returns an `external_id`
column for every row. The value is the upstream short code per resource type:

| resource_type | `external_id` is | today's `identifier` is |
|---|---|---|
| CARRIER | `prve_codigo` | `prve_nif` (RUT) |
| DRIVER  | `cond_codigo` | RUT |
| TRUCK   | `cami_matricula` (license plate) | license plate |
| TRAILER | `remo_matricula` (license plate) | license plate |

Per Erick: *"ese es el codigo que deberias transmitir a alerce — para todos los
recurso"*. For this plan we **only** swap the carrier hop (`proveedor`); driver
is held back as an integration-team coordination item, truck/trailer would be
no-op refactors. See "Out of scope" below.

This is the frontend counterpart to ecm-coordinator PR #250
(`feat(alerce): source proveedor from supplierPrveCodigo`). PR #250 sourced
`proveedor` from a service-level Activiti variable populated by the sync job —
which only covers ~19% of services on prod and goes stale if the planner picks
a different carrier than the one originally synced. Sourcing from the carrier
the planner actually selects is the better source of truth and closes that
coverage gap.

## Goal

When a planner confirms an assignment in the calendar "Asignar viaje" flow,
the outbound Alerce `ModificacionRecursoServicios` request carries
`proveedor = <selected carrier's prve_codigo>`, sourced from the carrier
select option (not from the trip's Activiti variables, not from
`fn_rd_resolve_resource_identifiers`).

## Current state (file:line citations)

### Frontend (`turbo-repo/apps/app/src/`)

- `app/api/utils/pgrest-client.ts:486–500` — `PgrestAccreditedResourceRow`
  (the proxy row shape). **Missing `external_id`.**
- `features/calendar/services/accredited-resources.service.ts:13–25` —
  client-side mirror `AccreditedResource`. **Missing `external_id`.**
- `features/calendar/components/planning/sidebar-tabs/assignment/assignment-form.tsx:177–263` —
  the four `*RowToOption` mappers; none expose external_id today.
  `value.carrier` (etc.) is a `resource_id` UUID.
- `features/calendar/components/planning/planning-sidebar-form.tsx:200–214` —
  `assignmentOverrides()` writes only the UUID into `assignedCarrier` on
  `SelectedService`.
- `features/calendar/components/planning/planning-selection-context.tsx:631`
  and `:1021` — `SelectedService.assignedCarrier` + zod schema. UUID only.
- `app/api/calendar/bookings/binding-helpers.ts:31–69` —
  `extractCalendarBindingPayload()` reads `assignedCarrier` (UUID) from the
  booking's `resource.data` and forwards as `carrier_id`.
- `features/common/providers/alfresco-api/alfresco-api.provider.ts:270–280` —
  `CalendarBindingPayload`. No external-id field.

### Backend (`ecm-coordinator/src/main/java/cl/mintral/`)

- `features/calendar/binding/model/AssignmentResourceTuple.java:14–63` — the
  binding payload model. Fields: `tipo_servicio`, `numero_servicio`,
  `calendar_id`, `carrier_id`, `driver_id`, `driver2_id`, `truck_id`,
  `trailer_id`. Carries UUIDs.
- `features/alerce/resources/AlerceResourceModificationByIdService.java:85–140`
  — `pushAssignment`. After PR #250:
  - `proveedor` ← `bindingService.getSupplierPrveCodigo(numeroServicio)`
    (Activiti var, source of staleness).
  - `conductor` / `conductor2` / `camion` / `remolque` ← still from
    `fn_rd_resolve_resource_identifiers` UUID→code resolver.
- `:225–238` — `buildAlerceRequest` uses `prveCodigo` for `proveedor`.

## Approach — lockstep replace

Add a new required-on-`stage="assigned"` field `carrier_external_id` to the
binding payload. Plumb it end-to-end. Backend reads **only** the new field
for `proveedor` — the PR #250 `bindingService.getSupplierPrveCodigo(...)`
read is removed. Existing carrier UUID (`carrier_id`) continues to flow
because the backend still needs it for the existence probe
(`fn_rd_resolve_resource_identifiers` resolves the other three slots and
sanity-checks the carrier UUID).

Rationale: the user picked the cleaner end-state. Deploys are coordinated —
frontend + backend ship together in a single release window. The
`mintral:supplierPrveCodigo` Activiti variable, the content-model property,
and the `LIVE_TRIP_VARIABLE_MAPPINGS` entry from PR #249/250 become dead
weight in `pushAssignment` but can stay on the model (they remain useful for
display / audit / future surfaces); deleting them is a separate cleanup PR
that doesn't block this work.

Deploy order — backend first, then frontend. If frontend ships first against
a backend that hasn't picked up the new field, `proveedor` would silently
fall through to `null` (Alerce's existing soft-fail). Backend-first means a
stale frontend keeps sending `carrier_external_id=null` until it updates,
and the backend will log + warn but accept the request — same soft-fail
window PR #250 already tolerates.

## Phases — work one at a time, ship between phases

### Phase A — frontend: surface `external_id` end-to-end (no Alerce impact yet)

Goal: the value is available in client state for every resource row, but
nothing on the wire changes yet.

1. `app/api/utils/pgrest-client.ts:488–500` — add
   `external_id: string | null` to `PgrestAccreditedResourceRow`. Confirm the
   proxy route (`app/api/calendar/accredited-resources/route.ts`) passes the
   column through unchanged (it currently spreads the row JSON; no whitelist).
2. `features/calendar/services/accredited-resources.service.ts:13–25` —
   mirror the field on `AccreditedResource`.
3. `assignment-form.tsx:177–263` — extend each Option type
   (`CarrierOption`, `DriverOption`, `TruckOption`, `TrailerOption`) with an
   `externalId: string | null` field and populate it in each `*RowToOption`
   mapper. Driver/truck/trailer get the field today even though only the
   carrier value is wired downstream — keeps the four mappers symmetric and
   sets up Phase E without re-touching the file.
4. Verify TypeScript and the existing dropdown components compile against
   the wider Option type (they should — the field is additive and unused).

Acceptance: `external_id` is visible on rows in React DevTools when the
dropdown is open; nothing else changes; no e2e behavior change.

### Phase B — frontend: persist on `SelectedService` and write into the booking payload

1. `planning-selection-context.tsx:631` and `:1021` — add
   `assignedCarrierExternalId?: string` to `SelectedService` and the zod
   schema. (Add `assignedDriverExternalId` / `assignedDriver2ExternalId` /
   `assignedTruckExternalId` / `assignedTrailerExternalId` at the same time
   so the schema bump is one PR; population stays carrier-only.)
2. `planning-sidebar-form.tsx:200–214` — `assignmentOverrides` looks up the
   selected carrier in the current `carrierOptions` (or accreditedCarriers
   rows) by id, copies `externalId` into `out.assignedCarrierExternalId`.
   Mirror `assignmentDataFromService` so reopening hydrates it.
3. Form state: `AssignmentFormData` does **not** need to carry the codes —
   the option list is the source of truth at submit time and the value is
   re-derived on reopen from `SelectedService`.

Acceptance: confirming an assignment writes
`assignedCarrierExternalId` into the booking's `resource.data`. Reopening the
sidebar still hydrates the dropdown correctly (the carrier UUID is the keying
field; the external id rides alongside).

### Phase C — frontend: extend binding payload

1. `binding-helpers.ts:31–69` —
   `extractCalendarBindingPayload`: read
   `readString(data, "assignedCarrierExternalId")` and assign to
   `payload.carrier_external_id` when `stage="assigned"`. Always write the
   field (including the empty-string case, sent as `null`); the backend logs
   a soft warning when it's missing, matching today's null-`proveedor`
   policy on the Java side.
2. `alfresco-api.provider.ts:270–280` — extend `CalendarBindingPayload`:
   ```ts
   carrier_external_id?: string | null;
   ```
3. Tests — there are no existing tests for `extractCalendarBindingPayload`
   (verified). Add `binding-helpers.test.ts` covering: (a) carrier with
   external_id → field populated, (b) carrier whose row has null
   external_id → field is `null` (no crash), (c) `stage="planned"` → field
   omitted from the payload.

Acceptance: a network capture of `POST /alfresco/s/mintral/calendar/binding`
shows the new field on assignment.

### Phase D — backend (ecm-coordinator): consume the new field, drop Activiti-var read

Separate PR in ecm-coordinator. Lands together with frontend Phases A–C in a
single release window.

1. `AssignmentResourceTuple.java` — add `carrierExternalId` field with
   `@JSONField(name = "carrier_external_id")`, getter/setter, and include
   it in `copyTuple`.
2. `CalendarBindingWebscript.java` — pass through; no extra validation
   (the null-`proveedor` policy already handles missing values).
3. `AlerceResourceModificationByIdService.pushAssignment`:
   - Replace
     ```java
     var prveCodigo = bindingService.getSupplierPrveCodigo(request.getNumeroServicio());
     ```
     with
     ```java
     var prveCodigo = request.getCarrierExternalId();
     ```
   - Keep the existing null/blank soft-fail + warn log unchanged.
   - The hash already includes `prveCodigo`; no `hashTuple` change.
4. `CalendarBindingService.getSupplierPrveCodigo(...)` is now unused by
   `pushAssignment`. Either delete it (and its test) in the same PR, or
   leave it dead-code and remove in the model-cleanup follow-up — author's
   call. The Activiti variable / content-model property / sync wiring from
   PR #249/250 stay; removing them is a separate cleanup PR.
5. Tests: update `AlerceResourceModificationByIdServiceTest`:
   - happy path: assert `proveedor` comes from `request.carrierExternalId`,
     not from the bindingService.
   - null path: `carrierExternalId == null` → `proveedor=null` + warn log
     (existing assertion, just change the source).
   - hash-invalidation test: source the new value from the request instead
     of the service variable.
   - remove the now-irrelevant `getSupplierPrveCodigo` mocking from
     `pushAssignment` setup.

### Phase E — (deferred) extend to driver / truck / trailer

Out of scope for this plan. Open questions to resolve before tackling:

- **Driver**: switch `conductor` / `conductor2` from RUT (resolver output)
  to `cond_codigo` (`external_id`). Requires confirmation from the Alerce
  integration team that the endpoint accepts `cond_codigo` instead of RUT —
  PR #250 deliberately did not touch this field. If yes, the same
  lockstep-replace pattern applies (`driver_external_id`,
  `driver2_external_id`).
- **Truck / trailer**: `cami_matricula` / `remo_matricula` already equal
  the resolver's plate output, so the switch is a no-op semantically and
  would only shave one pgrest round-trip — defer until there's a measured
  reason.
- **Activiti-var / model wiring cleanup**: remove
  `mintral:supplierPrveCodigo`, the `jsonKeyMapperV2` entry,
  `LIVE_TRIP_VARIABLE_MAPPINGS` entry, and the `services` table column read
  from PR #249/250 once we're sure no other surface consumes it. Separate
  PR, separate release.

## Out of scope

- The `ams.fn_rd_accredited_resources` SQL change itself (Erick owns).
- Driver / truck / trailer `external_id` plumbing on the wire (see Phase E).
- Removing the `mintral:supplierPrveCodigo` Activiti variable / sync wiring
  added in PR #249/250 (see Phase E).
- Frontend UI surfaces that expose the new code to the user (none planned).

## Test plan (per phase)

- **Phase A**: typecheck clean; render an `accredited-resources` row in
  React DevTools, confirm `external_id` is present.
- **Phase B**: confirm an assignment, reopen, confirm
  `assignedCarrierExternalId` survives round-trip. Server logs show
  unchanged `carrier_id` on the binding call (no wire change yet).
- **Phase C**: `binding-helpers.test.ts` unit tests; manual: capture the
  outbound binding payload from a real assign and assert
  `carrier_external_id` is populated.
- **Phase D** (backend): unit + manual against coordinador-dev — outbound
  Alerce request body shows `"proveedor": "<prve_codigo>"`, sourced from the
  binding payload not the Activiti var. Pre-release: assert
  `pushAssignment` no longer calls `getSupplierPrveCodigo` (mock-verify or
  grep the codepath).
- **Coordination**: deploy backend first, then frontend, in a single release
  window. A stale frontend during the gap sends `carrier_external_id=null`
  and the backend logs the existing soft-warn — no hard failure.

## Risks / non-obvious gotchas

- The carrier select supports pagination + search. At submit time, the
  selected carrier's row might be off-page if the user filtered after
  selecting. Mitigation: the `useAccreditedResources` hook already pins
  selected ids via the `selectedIds` opt (assignment-form.tsx:286) — the
  pinned row carries the row data, so the `external_id` is reliably
  reachable from `accreditedCarriers` regardless of scroll/filter state.
  Verify pinning still returns the row when reopening a saved service whose
  carrier is no longer in the accredited set (edge case: a
  previously-acredited carrier later deactivated).
- `external_id` is nullable in the SQL. On prod, PR #250 reported
  364/368 carriers have a code — a small minority of valid selections will
  flow with `null` external_id. The fallback to the Activiti var (Phase D)
  covers some of those; pure-null cases continue to hit the existing
  soft-fail-with-warning path in `pushAssignment`. No new failure mode.
- Form state currently keys assignment by UUID (`value.carrier`). Don't
  switch the keying — UUID is still the carrier identity for the existence
  probe and resolver. `external_id` rides alongside, not as a replacement.

## File-level change list (estimate)

Frontend (this repo):
- `turbo-repo/apps/app/src/app/api/utils/pgrest-client.ts` (+1 line)
- `turbo-repo/apps/app/src/features/calendar/services/accredited-resources.service.ts` (+1)
- `turbo-repo/apps/app/src/features/calendar/components/planning/sidebar-tabs/assignment/assignment-form.tsx` (~+4: 4 Option types, 4 mappers)
- `turbo-repo/apps/app/src/features/calendar/components/planning/planning-selection-context.tsx` (~+10: 5 interface fields, 5 zod fields)
- `turbo-repo/apps/app/src/features/calendar/components/planning/planning-sidebar-form.tsx` (~+6: 1 override write, 1 hydrate read, helper lookup)
- `turbo-repo/apps/app/src/app/api/calendar/bookings/binding-helpers.ts` (~+3)
- `turbo-repo/apps/app/src/features/common/providers/alfresco-api/alfresco-api.provider.ts` (+1)
- `turbo-repo/apps/app/src/app/api/calendar/bookings/binding-helpers.test.ts` (new)

Backend (ecm-coordinator, separate PR):
- `AssignmentResourceTuple.java`, `AlerceResourceModificationByIdService.java`,
  and the existing `AlerceResourceModificationByIdServiceTest.java`.
