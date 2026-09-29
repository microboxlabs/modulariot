# Control Tower API

Org-scoped REST API in the modulith for the Control Tower treatment screen:
treatment episodes and their actions, the "who to call" contacts, and an
audit log. The option lists behind the forms come from the core selectables
API.

**Status: demo data.** Everything lives in memory in the modulith process and is
lost on restart. Contacts and a short treatment history per symptom are seeded
the first time they are read. The data layer is a separate piece of work; it
replaces the `store` package implementations without changing this contract.

| | |
|---|---|
| Base path | `/api/v1/orgs/{organizationId}/control-tower` |
| OpenAPI | `/q/openapi`, tags `Control Tower — *` |
| Auth | Bearer JWT (`oidc`). Session token → user; M2M token → must match the org's `tenant_client_id` |
| Tenant | Resolved by `OrganizationRequestFilter` from the org slug in the path. Never read from the body or query |
| Actor | User email (session) or client id (M2M). Never read from the body |
| Component | `miot.component.symptoms.enabled=true` (build-time flag, included in CI) |
| Code | `quarkus-srv/miot-symptoms`, packages `api`, `service`, `store`, `domain`, `dto` |

## Treatments

| Operation | Method and path | Notes |
|---|---|---|
| `listSymptomTreatments` | `GET /symptoms/{symptomId}/treatments` | Episodes oldest first, each with its actions |
| `openTreatment` | `POST /symptoms/{symptomId}/treatments` | Body `{type, assetId, tripId, note}`. 201 new; 200 returns the episode the caller already has open on this symptom |
| `getTreatment` | `GET /treatments/{treatmentId}` | |
| `addTreatmentAction` | `POST /treatments/{treatmentId}/actions` | 201. Only while `OPEN` |
| `closeTreatment` | `POST /treatments/{treatmentId}/close` | Body `{resolution, note}`, optional. Needs at least one action |
| `cancelTreatment` | `POST /treatments/{treatmentId}/cancel` | Body `{reason}`, optional |

`type` is the form the episode was opened from: `CALL`, `IGNORE_CONDITION`,
`INVALIDATE_SYMPTOM`. An episode opened as a call can end with an ignore or
invalidate action, because the call form lets the operator switch forms.
`status`: `OPEN`, `CLOSED`, `CANCELLED`.

Action body:

| Field | Type | Meaning |
|---|---|---|
| `kind` | `CALL` `IGNORE` `INVALIDATE` `NOTE` | Required |
| `contactId` | string | A tenant contact. Name, role and phone are copied onto the action |
| `contactName`, `contactRole`, `contactPhone` | string | Ad hoc contact, e.g. the trip's driver. A `CALL` needs `contactId` or `contactName` |
| `method` | `PHONE` `WHATSAPP` `MEET` `TEAMS` | Channel used |
| `outcomeKey`, `outcomeLabel` | string | Option id and its text. `IGNORE` and `INVALIDATE` need one of them (the reason) |
| `answered` | boolean | Feeds the contact's answered and missed counts |
| `durationSeconds` | int ≥ 0 | |
| `message` | string | What the operator told the contact |
| `note` | string | What came back, or the operator's note |
| `tags` | string[] | Option ids from `call_tags` |
| `details` | object | Anything else, e.g. `{"durationSeconds": 1800}` on an ignore |

## Contacts

| Operation | Method and path | Who |
|---|---|---|
| `listContacts` | `GET /contacts?active` | member |
| `getContact` | `GET /contacts/{contactId}` | member |
| `createContact` | `POST /contacts` | member. Operators add contacts from the call panel |
| `updateContact` | `PATCH /contacts/{contactId}` | member |
| `deleteContact` | `DELETE /contacts/{contactId}` | owner |

Body `{name, role, phone, methods[], active, notes}`. `phone` is a full
international number; spaces and dashes are stripped. Each contact returns
`lastCalledAt`, `answered` and `missed`, computed from call actions.

## Selectables

The option lists behind the forms are not part of this API. They are a core
API, `/api/v1/orgs/{organizationId}/selectables` (`OrgSelectablesResource` in
`miot-core`). This module adds two things to it:

- `TreatmentFormSelectables`, the lists an organization starts with:
  `who_to_call`, `call_result`, `call_tags`, `ignore_reason`,
  `ignore_duration`, `invalidate_reason`. `call_result` option ids are
  `result_commits`, `result_corrected`, `result_rejects`, `result_no_answer`,
  `result_voicemail`.
- `SelectableAudit`, which writes every selectable change to the audit log
  below.

## Audit

| Operation | Method and path |
|---|---|
| `listAuditEvents` | `GET /audit?entityType&entityId&symptomId&before&limit` |

Newest first, `limit` up to 500. Actions: `treatment.opened`,
`treatment.action_added`, `treatment.closed`, `treatment.cancelled`,
`contact.created`, `contact.updated`, `contact.deleted`, `selectable.replaced`,
`selectable.deleted`, `selectable.reset`, `selectable.bindings_updated`.

## Errors

| Status | When |
|---|---|
| 400 | Validation. Body `{"error": "..."}` |
| 403 | Not a member, org path mismatch, or an owner-only write |
| 404 | Treatment or contact not found |
| 409 | Treatment not `OPEN`, or closing one with no actions |

## Treatment screen flow

| Screen step | Calls |
|---|---|
| Panel opens on a form | `openTreatment` with the form's type |
| Contact list | `listContacts`, plus the driver from the trip |
| Add contact | `createContact` |
| "Guardar y hacer otra llamada" | `addTreatmentAction {kind: CALL}` |
| "Finalizar tratamiento" | `addTreatmentAction {kind: CALL}` then `closeTreatment` |
| Ignore, from the menu or mid-call | `addTreatmentAction {kind: IGNORE, outcomeKey, details.durationSeconds}` then `closeTreatment` |
| Invalidate | `addTreatmentAction {kind: INVALIDATE, outcomeKey, note}` then `closeTreatment` |
| Panel closed with nothing recorded | `cancelTreatment` |
| Timeline and symptom card | `listSymptomTreatments` |
| Settings › Seleccionables | core selectables API |

The Next app reaches these through `/app/api/control-tower/*`, and the core
selectables through `/app/api/selectables/*`. Both resolve the active
organization server-side and forward the user's session token.

## Configuration

| Property | Env | Default | Meaning |
|---|---|---|---|
| `miot.component.symptoms.enabled` | `MIOT_COMPONENT_SYMPTOMS_ENABLED` | `${miot.component.all.enabled}` | Turns the module on |
| `miot.symptoms.cdc.enabled` | `MIOT_SYMPTOMS_CDC_ENABLED` | same as the component | Pulsar dispatcher. Set `false` on a modulith that only serves the API |
| `miot.symptoms.control-tower.demo-seed` | `MIOT_SYMPTOMS_CONTROL_TOWER_DEMO_SEED` | `false` (`true` in `quarkus:dev`) | Seed demo contacts and history. Leave off anywhere real symptoms are shown |

## Not in this API yet

- Real storage for everything above.
- Symptom reads (list, detail, ICU summary, map signals). The screen still reads them through the existing pgREST routes.
- The invalidate webhook, which the app still calls after an invalidate.
- Symptom rules (`fn_pt4_*`).
