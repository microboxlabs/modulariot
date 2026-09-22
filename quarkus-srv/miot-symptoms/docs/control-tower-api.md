# Control Tower API

Org-scoped REST API in the modulith for the Control Tower: what StreamHub
detected (symptoms) and what operators did about it (treatments). It replaces
the browser → Next route → pgREST RPC path the tower used until now.

| | |
|---|---|
| Base path | `/api/v1/orgs/{organizationId}/control-tower` |
| OpenAPI | `/q/openapi` (tags `Control Tower — *`), Swagger UI `/q/swagger-ui` |
| Auth | Bearer JWT (`oidc`). Session token → user; M2M token → must match the org's `tenant_client_id` |
| Tenant | Resolved by `OrganizationRequestFilter` from the org slug in the path. Never read from the body or query |
| Actor | User email (session) or client id (M2M). Never read from the body |
| Component | `miot.component.symptoms.enabled=true`, build-time flag included in CI |
| Module | `quarkus-srv/miot-symptoms`, package `com.microboxlabs.miot.symptoms.{api,service,persistence,domain,dto}` |

## Why it replaces the pgREST path

| Problem with the pgREST path | What the API does instead |
|---|---|
| Next routes call `api_modular_*` SQL functions with one process-global StreamHub client id. `api_modular_symptoms_icu_view` even hardcodes a tenant inside the function | Every read is the module's own SQL over `public.symptoms`, filtered by the tenant resolved from the org. Tenant id mapping is config (`miot.symptoms.client-id-map`) |
| Writes go straight to `process_treatment_manual_notifi_audit(p_json)`; the row keeps two free-text fields, nothing about who was called, how, or the outcome | A treatment episode with ordered actions (call attempts, decisions, notes), contacts, and typed outcomes. The legacy row is still written so the engine and old views keep working |
| No audit of who did what | `audit_events` row per write, queryable |
| No contract | OpenAPI with stable operation ids, ready for a generated client or MCP tools |
| Contacts and option lists live in browser localStorage | Tenant-scoped tables with owner-only writes |

## Endpoints

### Symptoms (reads over StreamHub GPS)

| Operation | Method and path | Notes |
|---|---|---|
| `listSymptoms` | `GET /symptoms?icuCode&assetId&tripId&symptomName&active&from&to&page&pageSize` | Newest first by first signal. `from`/`to` are ISO-8601 with offset. `pageSize` max 200 |
| `getSymptomsSummary` | `GET /symptoms/summary` | Counts per bucket: `underObservation`, `compromised`, `critical`, `codeBlack`, `underTreatment` |
| `getSymptom` | `GET /symptoms/{symptomId}` | One symptom with driver, trip type, open-treatment count |

A symptom row: `id, assetId, tripId, symptomName, symptomType, icuCode, icuCondition, firstSignalAt, lastSignalAt, finishedAt, active, withTrip, accumulatedValue, accumulatedSignals, driverName, tripType, openTreatmentCount, lastAssignedTo`.

### Treatments

| Operation | Method and path | Notes |
|---|---|---|
| `listSymptomTreatments` | `GET /symptoms/{symptomId}/treatments?includeLegacy=true` | Episodes from this API plus rows the older tower wrote |
| `openTreatment` | `POST /symptoms/{symptomId}/treatments` | Body `{type, assetId, tripId, note, idempotencyKey}`. Header `Idempotency-Key` works too. 201 new, 200 when the key was already used |
| `getTreatment` | `GET /treatments/{treatmentId}` | Episode with actions |
| `addTreatmentAction` | `POST /treatments/{treatmentId}/actions` | 201. Only while `OPEN` |
| `closeTreatment` | `POST /treatments/{treatmentId}/close` | Body `{resolution, note, messageToDriver, driverResponse}`, all optional |
| `cancelTreatment` | `POST /treatments/{treatmentId}/cancel` | Body `{reason}`. For a form opened and dismissed |

`type`: `CALL`, `IGNORE_CONDITION`, `INVALIDATE_SYMPTOM`. `status`: `OPEN`, `CLOSED`, `CANCELLED`.

Action body:

| Field | Type | Meaning |
|---|---|---|
| `kind` | `CALL` `IGNORE` `INVALIDATE` `NOTE` | `CALL` only on a `CALL` treatment, `IGNORE` only on `IGNORE_CONDITION`, `INVALIDATE` only on `INVALIDATE_SYMPTOM`. `NOTE` anywhere |
| `contactId` | uuid | A tenant contact. Name, role and phone are copied onto the action |
| `contactName`, `contactRole`, `contactPhone` | string | Ad hoc contact, e.g. the trip's driver. A `CALL` needs `contactId` or `contactName` |
| `method` | `PHONE` `WHATSAPP` `MEET` `TEAMS` | Channel used |
| `outcomeKey`, `outcomeLabel` | string | Option id and label from the bound selectable (`call_result`, `ignore_reason`, `invalidate_reason`). `IGNORE`/`INVALIDATE` need one of them |
| `answered` | boolean | Feeds contact statistics |
| `durationSeconds` | int ≥ 0 | |
| `note` | string | |
| `tags` | string[] | Option ids or labels from `call_tags` |
| `details` | object | Anything else, e.g. `{"duration": "30 minutos"}` for an ignore |

### Contacts

| Operation | Method and path | Who |
|---|---|---|
| `listContacts` | `GET /contacts?active` | member |
| `getContact` | `GET /contacts/{contactId}` | member |
| `createContact` | `POST /contacts` | owner |
| `updateContact` | `PATCH /contacts/{contactId}` | owner |
| `deleteContact` | `DELETE /contacts/{contactId}` | owner |

Body `{name, role, phone, methods[], active, notes}`. `phone` is a full international number; spaces and dashes are stripped. Each contact returns `lastCalledAt`, `answered`, `missed` derived from call actions.

### Selectables

| Operation | Method and path | Who |
|---|---|---|
| `listSelectables` | `GET /selectables` | member. Seeds defaults on first call |
| `getSelectable` | `GET /selectables/{key}` | member |
| `replaceSelectable` | `PUT /selectables/{key}` | owner. Whole-list replacement; keep option ids stable |
| `getSelectableBindings` | `GET /selectables/bindings` | member |
| `updateSelectableBindings` | `PUT /selectables/bindings` | owner. `{bindings: {fieldKey: selectableKey}}` |

Default keys: `call_result`, `call_tags`, `ignore_reason`, `ignore_duration`, `invalidate_reason`. A field with no binding uses the selectable whose key equals the field key.

### Audit

| Operation | Method and path |
|---|---|
| `listAuditEvents` | `GET /audit?entityType&entityId&symptomId&before&limit` |

Actions recorded: `treatment.opened`, `treatment.action_added`, `treatment.closed`, `treatment.cancelled`, `contact.created`, `contact.updated`, `contact.deleted`, `selectable.replaced`, `selectable.bindings_updated`.

## Errors

| Status | When |
|---|---|
| 400 | Validation (`{"error": "..."}`) |
| 403 | Not a member, org path mismatch, or owner required |
| 404 | Treatment, contact, selectable or symptom not found |
| 409 | Treatment not `OPEN` |
| 502 | StreamHub refused or was unreachable while mirroring a treatment |

## Legacy mirror

The symptom engine decides "under treatment" from `public.treatments` joined
through `public.symptom_treatments`, and the older tower screens list that
table. So the API keeps writing it, through the same function the previous UI
called:

| API call | Legacy write |
|---|---|
| `openTreatment` | insert `status=pending`, `treatment_type` from `type`, `assigned_to` = actor. The returned id is stored as `legacyTreatmentId` |
| `closeTreatment` | update the same row with `message` (who was contacted and how) and `driver_response` (outcomes and notes), or the values sent in the body |
| `cancelTreatment` | nothing. The engine expires the row |

The mirror runs before the local insert. If StreamHub refuses, nothing is stored and the client gets 502.

## Mapping from the new UI

| UI step | API |
|---|---|
| Open "Llamar a…" | `openTreatment {type: CALL, assetId, tripId}` with an `Idempotency-Key` |
| Pick a contact and dial | `listContacts` (tenant list) plus the driver from the symptom's trip |
| "Guardar y hacer otra llamada" | `addTreatmentAction {kind: CALL, ...}` then stay on the form |
| "Finalizar tratamiento" | `addTreatmentAction` for the last call, then `closeTreatment` |
| "Ignorar condición" | `openTreatment {type: IGNORE_CONDITION}` → `addTreatmentAction {kind: IGNORE, outcomeKey, details.duration}` → `closeTreatment` |
| "Invalidar síntoma" | `openTreatment {type: INVALIDATE_SYMPTOM}` → `addTreatmentAction {kind: INVALIDATE, outcomeKey}` → `closeTreatment` |
| Close the panel without saving | `cancelTreatment` |
| Timeline box | `listSymptomTreatments` |
| Settings › Selectables | `listSelectables`, `replaceSelectable`, bindings |
| Contact stats badges | `answered`, `missed`, `lastCalledAt` on each contact |

From the Next app, call the modulith through the existing `forwardToQuarkus` proxy helper with the user's session token; the app must not mint a StreamHub M2M token for these routes.

## Configuration

| Property | Env | Default | Meaning |
|---|---|---|---|
| `miot.component.symptoms.enabled` | `MIOT_COMPONENT_SYMPTOMS_ENABLED` | `${miot.component.all.enabled}` | Turns the module on (API and dispatcher) |
| `miot.symptoms.cdc.enabled` | `MIOT_SYMPTOMS_CDC_ENABLED` | same as the component | Pulsar subscription. Set `false` on a modulith that only serves the API |
| `miot.symptoms.gps.reactive-url`, `.username`, `.password` | `MIOT_SYMPTOMS_GPS_*` | unset | GPS database. Required for symptom reads and the legacy mirror |
| `miot.symptoms.client-id-map` | `MIOT_SYMPTOMS_CLIENT_ID_MAP` | empty | `tenantClientId=symptomsClientId,...` for tenants whose symptoms carry a different client id |

## Storage

Schema `miot_symptoms` on the modulith datasource:

| Table | Holds |
|---|---|
| `treatments` | Episodes, with `legacy_treatment_id` and an optional unique `idempotency_key` per tenant |
| `treatment_actions` | Ordered steps per episode; contact fields copied at the time of the call |
| `contacts` | Tenant contact list |
| `selectables`, `selectable_bindings` | Option lists and field bindings |
| `audit_events` | One row per write |

## Later

- Invalidate webhook: the app still fires `EXT_TASKS_WEBHOOK_URL` itself after `closeTreatment` on an `INVALIDATE_SYMPTOM`. Moving it here needs a connection in `miot-integrations`.
- Symptom rules (`fn_pt4_*` on the lab pgREST) are a separate family; they would sit under `/control-tower/rules` with the same conventions.
- MCP: expose the service layer as tools with `quarkus-mcp-server`; the operation ids above are the tool names.
- Contact suggestions per symptom (driver of the trip, carrier contacts) as `GET /symptoms/{id}/contacts`.
