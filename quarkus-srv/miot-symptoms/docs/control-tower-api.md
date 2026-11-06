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
| Permissions | One `controltower:*` permission per endpoint. See [Roles and permissions](#roles-and-permissions) |
| Code | `quarkus-srv/miot-symptoms`, packages `api`, `service`, `store`, `domain`, `dto` |

## Treatments

| Operation | Method and path | Notes |
|---|---|---|
| `listSymptomTreatments` | `GET /symptoms/{symptomId}/treatments` | Episodes oldest first, each with its actions |
| `openTreatment` | `POST /symptoms/{symptomId}/treatments` | Body `{type, assetId, tripId, note}`. 201 new; 200 returns the episode the caller already has open on this symptom |
| `getTreatment` | `GET /treatments/{treatmentId}` | |
| `addTreatmentAction` | `POST /treatments/{treatmentId}/actions` | 201. Only while `OPEN` |
| `closeTreatment` | `POST /treatments/{treatmentId}/close` | Body `{resolution, note}`, optional. Needs at least one action |
| `cancelTreatment` | `POST /treatments/{treatmentId}/cancel` | Body `{reason}`, optional. 409 on an engine case's hold |
| `resumeTreatment` | `POST /treatments/{treatmentId}/resume` | "Reanudar": ends a hold early, as if its time ran out. 409 when the treatment is not an open hold |

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
| `details` | object | Anything else. On an engine case's `IGNORE`: `scope` and `until_trip_end` (below). On a `NOTE`: `skipToStep` (below) |

A `NOTE` with `details.skipToStep` records that the operator skipped the
level's call script to that step (1-based, at least 2). It needs an engine
case and the reason in `note`. `performedBy` and `performedAt` say who and
when. The call panel reads the furthest skip made since the case's
`sla_since` from `listSymptomTreatments`, so a new level or the end of a hold
starts the script over. The app also sends `level` and `version`, and a UUID
`skipId` that it reuses on retries. Under the case's vehicle lock, a repeated
`skipId` in the operator's treatment returns the saved NOTE without another
action or audit event.
It also sends the panel's `slaSince`: the reader excludes a skip from a
different level or SLA interval even when a delayed save lands after the reset.

### Ignorar condición (engine cases)

An `IGNORE` on an engine case (negative symptom id) puts the case on hold and
sets its treatment type to `IGNORE_CONDITION`, including a mid-call ignore. The
treatment stays `OPEN` while the hold lasts; it is the hold. No other table.

| Field | Meaning |
|---|---|
| `durationSeconds` | How long, at most a day. Required unless `details.until_trip_end` |
| `details.scope` | `CASE` (default): this case. `SYMPTOM`: also any case of the same symptom on the vehicle. `ALL`: any case of any symptom on the vehicle |
| `details.until_trip_end` | Hold until the case's trip ends. Needs a running trip |
| `note` | Required for "Otro", or when the level's policy says so |

The server adds `case_level`, `case_condition` and `until` to the stored
details. 400 when the request breaks the policy, 409 when the case is closed or
already on hold. Changes are serialized per tenant and vehicle across pods.
Ordinary close and cancel return 409 for an engine hold; use Resume.

While on hold:

| Aspect | Behaviour |
|---|---|
| Symptom list and counts | Out of the active list and counts. `p_icu_code=9` lists the held cases; the counts add `Ignored` |
| Row and header | `ignored: {treatment_id, since, until, until_trip_end, scope, by}`; `until` is null until the trip ends |
| Level | Does not rise; the case may still close by its symptom's rule |
| New cases in scope | Do not open. The evaluator records a `HELD` transition as evidence, once per run |
| SLA | Counts as attended |
| Notifications | `symptom.case.ignored` cancels waiting notification rules and queued sends for every covered case |

When the hold ends (time, `resumeTreatment`, trip end) the treatment closes
with a `resolution`:

| `resolution` | When |
|---|---|
| `resolved_after_ignore` | The case had closed by its symptom's rule |
| `returned_after_ignore` | The case is still open: back in the tower at its level, with `returned_after_ignore_at` on its row. The next level and a new SLA count from then |
| `ignored` | The trip ended: the held cases closed |

Holds are read from the store on each evaluation so another pod sees them immediately.
At expiry or resume the close rule runs on the latest condition evidence and the
level timers restart from the return, including when no signal arrived during the hold.
Expired holds remain held until that return is recorded. Repeated SLA expiries at
the same level replace the previous period's mark, once per new attention period.

A timer ends the due holds every 30 s (`miot.symptoms.holds.every`, off with
`miot.symptoms.holds.enabled=false`). The timeline shows the `IGNORE` with
`ignored_until`, `until_trip_end` and `scope`, and the end as a
`fin de ignorar` row with `resolution`, `at` and `by` (`system` when it ran
out).

Each level of a symptom version may set `ignore`:

| Field | Default |
|---|---|
| `allowed` | `true` |
| `max_duration` | none; ISO-8601, e.g. `PT30M`. With it, "until the trip ends" is refused |
| `note_required` | only for "Otro" |
| `scopes` | all of `CASE`, `SYMPTOM`, `ALL` |

## Contacts

| Operation | Method and path | Who |
|---|---|---|
| `listContacts` | `GET /contacts?active` | `controltower:view` |
| `getContact` | `GET /contacts/{contactId}` | `controltower:view` |
| `matchTripContacts` | `POST /contacts/trip` | `controltower:view`. The book's people for each step condition, with the case trip's RUTs, origin and destination |
| `contactTripPlaces` | `GET /contacts/trip-places` | `controltower:view`. The live trips' origins and destinations, offered as contact tags |
| `createContact` | `POST /contacts` | `controltower:contact.write`. Operators add contacts from the call panel |
| `importContacts` | `POST /contacts/import` | `controltower:contact.write`. Body `{contacts: [...]}`, up to 1000 |
| `updateContact` | `PATCH /contacts/{contactId}` | `controltower:contact.write` |
| `deleteContact` | `DELETE /contacts/{contactId}` | `controltower:contact.delete` |

Contact body:

| Field | Type | Meaning |
|---|---|---|
| `name` | string | Required on create |
| `role`, `notes` | string | Free text. The app's contact book shows `notes` as the description |
| `phone` | string | Full international number; spaces and dashes are stripped. When not sent, the `channels` phone, or else the WhatsApp number |
| `methods` | `PHONE` `WHATSAPP` `MEET` `TEAMS` | When not sent, the channels that have an address. Empty means every channel is offered |
| `active` | boolean | Default `true` |
| `nationalId` | string | Stored without dots or dashes, upper case. Unique per organization |
| `nationalIdType` | string | Default `RUT`. A `RUT` must have a valid check digit |
| `company`, `position` | string | |
| `channels` | `{phone, whatsapp, meet, teams}` | Address per channel: numbers for phone and WhatsApp, account emails for Meet and Teams |
| `tags` | string[] | Tag names. Trimmed, each once regardless of case |
| `memberUserId` | string | The organization member this contact is, if any |
| `provisional` | boolean | Captured from the call panel, to be completed later. Default `false` |

On `PATCH`, a field not sent keeps its value and an empty string clears a
text field. Each contact returns `lastCalledAt`, `answered` and `missed`,
computed from call actions.

A national id already used by another contact of the organization is a 409.
`importContacts` creates each row on its own and returns
`{created, skipped, errors, rows: [{index, status, reason, contact}]}`, where
`status` is `created`, `skipped` (national id already in the book, or repeated
in the request) or `error` (the row is invalid; `reason` says why).

`matchTripContacts` takes `{symptomId, conditions}`. Each condition is an
operator step's `who`: CEL over `contact` and `event`, the same as a
communication rule's "contacts from the book" audience. It answers
`{data, matches, problems}`:

| Field | Meaning |
|---|---|
| `data` | `event.data` the conditions read, each field only when the trip has it (table below) |
| `matches` | For each condition, in order, the ids of the active contacts that meet it |
| `problems` | For each condition, its compile problem, or null |

`event.data`:

| Field | Meaning |
|---|---|
| `driverRut`, `secondDriverRut`, `carrierRut` | The trip's RUTs, without dots or dashes, upper case, with `driverIdType`, `secondDriverIdType` and `carrierIdType` |
| `origin`, `destination` | The trip's origin and destination, as the trip writes them |
| `originKey`, `destinationKey` | The same in lower case, without accents and with single spaces |
| `originId`, `destinationId` | The geofence ids |

`contact` has `role`, `roleKey`, `tags`, `tagKeys`, `company`, `companyRut`,
`nationalId`, `position`, `member`, `email` and `whatsapp`; a missing text is
`''`. `tagKeys` are the tags written as `originKey`, so
`contact.role == 'CAT' && event.data.originKey in contact.tagKeys` finds the
CAT whose tags include the trip's origin, whatever the case, accents or
spacing. `event.data.origin in contact.tags` matches only a tag written
exactly as the trip writes the place.

`contactTripPlaces` returns `[{label, origins, destinations}]`: each place of
the live trips once, ignoring case, accents and spacing, as most trips write
it, with how many trips start and end there; the busiest first, at most 300.

Only
engine cases (negative ids) have a trip; for other cases `data` is empty, so a
condition that reads it meets nobody. At most 20 conditions per request. 503
when the communication rules component is off.

A CALL action with a `contactId` must use one of the contact's `methods`; any
other `method` is a 400.

## Map

| Operation | Method and path | Returns |
|---|---|---|
| `listMapPositions` | `GET /map/positions` | Last position of each of the organization's assets, on a trip or not |
| `getMapSummary` | `GET /map/summary` | Service, fleet and symptom totals shown beside the map |
| `listMapSymptoms` | `GET /map/symptoms?p_*` | One page of symptoms with `total_rows`, `total_pages`, `page`, `page_size` and `symptom_name_list`. Filters: `p_asset_id`, `p_trip_id`, `p_driver_id`, `p_carrier_id`, `p_origin`, `p_destination`, `p_symptom_name`, `p_icu_code`, `p_page`, `p_page_size`, `p_start_date_historic`, `p_end_date_historic`. Any other is a 400 |
| `countSymptomConditions` | `GET /map/conditions?from&to` | Symptom counts by condition name. Active symptoms, or with `from` and `to` (ISO-8601, both or neither) those created in that range |

All of them need `controltower:view`. The modulith calls the GPS database
functions through PostgREST (`miot.symptoms.gps.rpc-url`) with a token for the
organization's own Auth0 application, so each organization gets only its own
data. The token comes from the caching token endpoint and is reused until a
minute before it expires (see `miot-core/docs/organization-access.md`). Each
answer is kept for five seconds per organization.

### Legacy symptoms setting

`miot.symptoms.legacy.enabled` (env `MIOT_SYMPTOMS_LEGACY_ENABLED`), default `true`. An installation setting: it
applies to every organization of the deployment. The app reads the same env name (see below).

| Endpoint | `true` (default) | `false` |
|---|---|---|
| `GET /map/symptoms` | GPS database page, with the evaluator's open cases first on page 1 | The evaluator's cases only, paged with `p_page` and `p_page_size` (default 10). Totals count the matching cases, at most 200. Driver, carrier, origin and destination match the case's live trip (`miot_trips.trip_live`); a case without one matches none of them. `p_driver_id`: either driver's RUT. `p_carrier_id`: the carrier's RUT (`miot_fleet.carrier.rut`) or id. RUTs ignore dots, dashes, spaces and case. `p_origin`, `p_destination`: the whole place name, ignoring case. Rows carry the trip's `driver`, `carrier`, `origin` and `destination` names |
| `GET /map/conditions` | GPS database counts plus the open cases | The open cases only. With `from` and `to`, the cases opened in that range by current level |
| `GET /map/positions` | GPS database positions with its symptom fields | GPS database positions. `symptoms_condition` is the vehicle's highest open case level (0 with none), `associate_symptoms` lists its open cases, `speed_limit_condition` is null, `speed_limit` and `lost_signal` are left out |
| `GET /map/summary` | GPS database | Same shape. Symptom items count the open cases by level; the services and fleet items and `stable_condition` have no case equivalent and are 0 |
| `GET /map/symptoms/{id}`, `/signals`, `/positions` with a positive id | GPS database symptom | 404 |

**The inbox lists only cases that need an operator.** Without `from` and `to`, `GET /map/symptoms` and `GET /map/conditions` keep the open cases whose current level has `response.operator: true` in the published version the case runs on. A level with `operator: false`, or without a response, stays out; the case enters when it escalates to a level with `operator: true` and leaves when it goes back down. The history (with `from` and `to`), the map positions and a case's own endpoints keep every case.

**Inbox order.** The inbox comes ordered by criticality: highest level first (código negro, then 3, 2, 1). Within a level, the SLA that runs out soonest goes first, so overdue cases are at the top; a level without SLA goes last. Then the oldest arrival at the level, then the case id. The SLA runs from when the case reached its level, or from its return from a hold if later; each row carries that start as `sla_since`. The treatment header exposes the same value in `symptom_info.sla_since` for the call panel and its step deadlines. Paging follows this order, and the 200-case limit keeps the most critical. The history keeps its own order (newest first).

In engine-only mode, `p_icu_code=6` selects cases with an open treatment, independently of their severity.
The store applies this predicate before its 200-case limit.

If the optional trip or fleet tables are absent, trip filters match no cases. Other database failures
propagate as errors instead of returning a successful empty page.

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

## Symptom templates

Templates are the symptoms of the reserved tenant `platform`. They have drafts, checks and versions like any symptom, and are always `OFF`. Migration `V0.9.3` seeds seven at `1.0.0`.

| Route | Who | Notes |
|---|---|---|
| `GET /symptom-definitions/templates` | `controltower:view` | Published templates with their `version` |
| `POST /symptom-definitions/from-template` | `controltower:symptom.edit` | The copy records `templateKey` and `templateVersion` |
| `POST /symptom-definitions/{id}/save-as-template` | platform owner with `controltower:view` | Body `{version, templateKey, name}`, all optional. Saves the version in force (else the draft) as a template draft: a new template, or the draft of `templateKey`. Notice connections, message templates and recipients are dropped. Platform data sources only |
| `/api/v1/orgs/_platform/control-tower/symptom-definitions/**` | platform owner | Templates are the symptom definitions of the platform scope: list, create, get, identity, draft, validate, preview, publish plan, publish, rollback, fork, compare, describe, and `/control-tower/data-sources`. State, import, from-template, response and save-as-template answer 404 there; publishing ignores `state` |

Organizations see a template once a platform owner publishes it.

## Roles and permissions

Each endpoint declares one permission with `@PermissionsAllowed`; `ControlTowerAccessCatalog` lists them and the roles that grant them. Owners and Admins hold every permission.

| Permission | Endpoints |
|---|---|
| `controltower:view` | Every read, plus `describe`, `validate` and `preview` |
| `controltower:case.treat` | Treatments: open, actions, close, cancel, resume |
| `controltower:contact.write` | Contacts: create, import, update |
| `controltower:contact.delete` | Contacts: delete |
| `controltower:symptom.edit` | Symptoms: create, from template, import, identity, draft, fork |
| `controltower:symptom.publish` | Symptoms: publish, roll back, change state |
| `controltower:settings.update` | Tower settings |

| Role | Permissions |
|---|---|
| `CONTROL_TOWER_VIEWER` | view |
| `CONTROL_TOWER_OPERATOR` | view, case.treat, contact.write |
| `CONTROL_TOWER_MAINTAINER` | all of the above plus contact.delete, symptom.edit, symptom.publish, settings.update |

`controltower:places.edit` (the app's places editor) is disabled for now: it is not declared, so no one holds it, Owners and Admins included, and the app hides the editor. `ControlTowerAccessCatalog.PLACES_EDIT` lists the steps to turn it back on.

With Alfresco membership, a member who holds no control tower role is an Operator, as before the roles existed. The organization's own M2M client is one too.

`GET /access` returns the caller's `baseRole`, `roles` and `controltower:*` permissions; the app shows only the actions they allow. Memberships, base roles and role assignment are described in the core organization access API (`/api/v1/orgs/{org}/me/access`, `/api/v1/access/catalog`, `/api/v1/orgs/{org}/roles/{roleCode}`, `/api/v1/platform/orgs`).

## Errors

| Status | When |
|---|---|
| 400 | Validation. Body `{"error": "..."}` |
| 403 | Not a member, org path mismatch, or a missing control tower permission |
| 404 | Treatment or contact not found |
| 409 | Treatment not `OPEN`, closing one with no actions, or a contact's national id already used |
| 503 | Map data cannot be read: `miot.symptoms.gps.rpc-url` unset, the organization has no Auth0 application, or the GPS database failed |

## Treatment screen flow

| Screen step | Calls |
|---|---|
| Panel opens on a form | `openTreatment` with the form's type |
| Contact list | `listContacts`, plus the driver from the trip |
| Add contact | `createContact` |
| "Saltar paso" | `openTreatment {type: CALL}` then `addTreatmentAction {kind: NOTE, note, details.skipToStep}`; the treatment stays open |
| "Guardar y hacer otra llamada" | `addTreatmentAction {kind: CALL}` |
| "Finalizar tratamiento" | `addTreatmentAction {kind: CALL}` then `closeTreatment` |
| Ignore, from the menu or mid-call | `addTreatmentAction {kind: IGNORE, outcomeKey, durationSeconds, details.scope}`; the treatment stays open while the hold lasts |
| "Reanudar" | `resumeTreatment` |
| Invalidate | `addTreatmentAction {kind: INVALIDATE, outcomeKey, note}` then `closeTreatment` |
| Panel closed with nothing recorded | `cancelTreatment` |
| Timeline and symptom card | `listSymptomTreatments` |
| Settings › Seleccionables | core selectables API |

The Next app reaches these through `/app/api/control-tower/*`, and the map
endpoints through `/app/api/map`, `/app/api/map/resume`,
`/app/api/symptoms/dashboard` and `/app/api/symptoms/table`. The core
selectables through `/app/api/selectables/*`. Both resolve the active
organization server-side and forward the user's session token.

## Configuration

| Property | Env | Default | Meaning |
|---|---|---|---|
| `miot.component.symptoms.enabled` | `MIOT_COMPONENT_SYMPTOMS_ENABLED` | `${miot.component.all.enabled}` | Turns the module on |
| `miot.symptoms.cdc.enabled` | `MIOT_SYMPTOMS_CDC_ENABLED` | same as the component | Pulsar dispatcher. Set `false` on a modulith that only serves the API |
| `miot.symptoms.gps.rpc-url` | `MIOT_SYMPTOMS_GPS_RPC_URL` | none | PostgREST in front of the GPS database, for the map endpoints |
| `miot.symptoms.control-tower.demo-seed` | `MIOT_SYMPTOMS_CONTROL_TOWER_DEMO_SEED` | `false` (`true` in `quarkus:dev`) | Seed demo contacts and history. Leave off anywhere real symptoms are shown |

## Not in this API yet

- Real storage for everything above.
- Symptom reads (list, detail, ICU summary, map signals). The screen still reads them through the existing pgREST routes; only the map positions, summary, symptom table and condition counts come from this API.
- The invalidate webhook, which the app still calls after an invalidate.
- Symptom rules (`fn_pt4_*`).
