# Review-channel dispatch — executing a connection operation from a review verdict

**Status:** Phases 1–4 implemented (the backend is complete). Phase 5 (frontend swap) planned.

## Problem

A workflow column can be marked as a *reviewed* stage: when a service in it is
approved or rejected, the verdict must be pushed to an external system —
authenticated by a stored credential, with a per-field payload the operator maps
themselves (no code change per partner).

Most of the nouns already exist in this module:

| Piece | Where | State |
|---|---|---|
| Auth material | `credential_profiles` + `IntegrationSecretCipher` | done |
| Provider endpoint | `integration_connections` (base URL, provider, credential, status) | done |
| Endpoint contract | `integration_operations` (method, path, request/response schema) | done |
| Durable queue | `async_jobs` + `AsyncJobService` (dedupe, lease, backoff, park) | done |
| Generic worker | `ModulithJobWorker` → `ModulithJobHandler` by `job_type` | done |
| Ops visibility | `OrgAsyncJobsConsoleResource`, `JobEventEmitter`, `JobHttpTrace` | done |

The **verb** is what's missing. Nothing in the codebase ever executes an
`integration_operation` — the catalog is write-only. Every outbound call today is
a bespoke hardcoded client (`CalendarBookingsClient`, `MetaWhatsAppClient`,
`WhatsAppConnectionTester`), each re-implementing URL joining, auth and error
mapping. `GenericConnectionTester.supports()` returns `false` and its test is a
stub that returns "runtime probe pending" without making a call.

So this feature is mostly **finishing the connection framework** — a generic
invoker any integration can use — plus a small review-specific binding on top.
That framing matters for sequencing: phases 1–2 are reusable infrastructure with
value independent of the review process.

## What's missing

1. **A connection+operation invoker.** No class resolves an operation, joins
   `{baseUrl}{path}`, applies method/body/auth, and calls.
2. **Operation lookup by name.** `IntegrationOperationRepository` only has
   `listByConnection(connectionId)`, and has **no tenant filter** — callers must
   go through `IntegrationConnectionService.getConnection(tenantCode, …)` first
   or they leak cross-tenant.
3. **`AuthType` → `AuthStrategy` dispatch.** Four strategies exist
   (bearer/basic/apikey/oauth2) but there is no registry (contrast
   `ConnectionTesterRegistry`) and no code that applies a `ResolvedAuth` to a
   request. The only consumer is `OAuth2CredentialTester`.
4. **`ResolvedConnection` carries no auth.** It exposes a raw `secret` map; the
   resolver drops `credential.authType()` on the floor.
5. **Resolution by connection id.** `resolve()` takes a `ProviderType` and
   returns *the* single active connection for it — fine for WhatsApp, wrong when
   a tenant has several partner endpoints.
6. **Payload templating.** No templating engine exists anywhere in `quarkus-srv`
   (no Qute/Handlebars/Mustache dependency). The only variable rendering is
   `WhatsAppTemplateRenderer`, a hardcoded map of 5 bodies.
7. **The binding + trigger.** No storage for "this column dispatches to that
   operation", and no verdict event.

## Design

### Vocabulary

The UI's **channel** is a `(connection, operation)` pair. The channel's **field
contract** is `integration_operations.request_schema` — a column that exists,
is already writable through the API, and is currently read by nothing. This plan
gives it its first reader, rather than adding a parallel concept.

`request_schema` is interpreted as a JSON-Schema subset:

```json
{ "type": "object",
  "properties": { "<fieldId>": { "type": "string|boolean|integer|number", "title": "…" } },
  "required": ["<fieldId>", "…"] }
```

### The binding

An earlier draft of this table keyed on `board_key` + `lane_key` with a
`trigger_mode` of `ON_REJECT`/`ON_REVIEW`, and was called
`review_channel_bindings`. That leaked one caller into the schema three times
over: reviews are only *an* instance of the general shape, which is

> when **event** happens in **scope**, if **condition**, send to
> **connection**/**operation**, shaped by **templates**.

A WhatsApp notification from the symptoms dashboard is the same sentence with
different nouns, and would otherwise have needed its own near-identical table.
So the binding is event-shaped, not kanban-shaped:

```sql
CREATE TABLE miot_integrations.integration_event_bindings (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_client_id VARCHAR(128) NOT NULL,   -- the Auth0 M2M client (see Terminology)
    owner_org_slug   VARCHAR(100) NOT NULL,   -- which org configured it
    event_type       VARCHAR(128) NOT NULL,   -- 'review.verdict', 'symptom.reported'
    scope_kind       VARCHAR(64),             -- 'kanban_lane', 'symptom_board'; NULL = every scope
    scope_key        VARCHAR(255),            -- opaque here; the producer defines its meaning
    connection_id    UUID NOT NULL REFERENCES miot_integrations.integration_connections(id) ON DELETE RESTRICT,
    operation_id     UUID     REFERENCES miot_integrations.integration_operations(id) ON DELETE RESTRICT,
    condition        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    field_templates  JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- fieldId -> template string
    enabled          BOOLEAN      NOT NULL DEFAULT false,
    active           BOOLEAN      NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by       TEXT,
    updated_by       TEXT
);
CREATE UNIQUE INDEX idx_integration_event_bindings_target
    ON miot_integrations.integration_event_bindings
       (tenant_client_id, owner_org_slug, event_type, scope_kind, scope_key, connection_id)
    WHERE active;
```

Both product cases land on it as **data, not schema**:

| | `event_type` | `scope_kind` / `scope_key` | connection |
|---|---|---|---|
| Kanban review | `review.verdict` | `kanban_lane` / `shipping:confirmCierre` | partner HTTP |
| Symptoms → WhatsApp | `symptom.reported` | `symptom_board` / `<boardId>` or NULL | WhatsApp |

Four things this buys:

- **`scope_kind`/`scope_key` are opaque to this module.** It never parses them.
  The producer decides what they mean — the discipline that stops the kanban (or
  the next caller) leaking back into the schema.
- **`condition` replaces `trigger_mode`.** "Only rejections" is one condition
  among many, not an enum member. The module already has prior art for a
  declarative filter in `WebhookFilterCompiler` / `WebhookFilterSpec` (GPS
  webhooks) rather than inventing a second filter language.
- **Fan-out is possible.** `connection_id` is in the unique key, so one event can
  notify WhatsApp *and* the partner API. The old `UNIQUE(tenant, board, lane)`
  permitted exactly one channel per column.
- **`operation_id` is nullable** — see the dispatcher SPI below.

`ON DELETE RESTRICT` so a connection still in use by a binding can't be deleted
out from under it — the same protection credentials already get (409 + `usedBy`).

### Org scoping: who a binding belongs to

`tenant_client_id` is **not an org identifier**. It is an Auth0 M2M client id, and
several orgs can share one — the seed script creates a child org with the *same*
`tenant_client_id` as its parent ("shared Auth0 M2M"). Orgs are identified by
**slug**. Every existing integrations query filters `WHERE tenant_code = $1`, so
today a child sharing its parent's M2M client already sees all of its connections,
credentials and jobs, and there is no way to give that child its own.

Bindings therefore carry `owner_org_slug` alongside the tenant key, and reads are
**parent-inclusive**: an org sees its own bindings plus its parent's.

```
read(org = traza) → WHERE tenant_client_id = :tenant
                      AND owner_org_slug IN ('traza', 'gama')
```

A parent configures once for its children; a child can still add its own. When
both define a binding for the same event+scope+connection, the child's wins —
the more specific owner is the more deliberate one.

### Channels other than HTTP: a dispatcher SPI

WhatsApp outbound does not go through `integration_operations` at all — it goes
through `MetaWhatsAppClient`, with `phone_number_id` in connection metadata and a
nested template-parameter body that a flat `fieldId -> template` map cannot
express. Forcing it into an operation row would be jamming it into a shape it
doesn't have.

So dispatch routes by the connection's `ProviderType` to a `ChannelDispatcher`,
the module's registry idiom for the third time (after `ConnectionTesterRegistry`
and `CredentialAuthRegistry`):

- **default** — the generic HTTP dispatcher, `IntegrationOperationInvoker` over the
  binding's `operation_id` (Phase 1, done).
- **WHATSAPP** — reuses `WhatsAppMessagingService`; ignores `operation_id`.

The dispatcher also **declares its field contract**, which is what the settings UI
renders: HTTP reads `integration_operations.request_schema`; WhatsApp declares its
template parameters. One table, one configuration UX, no per-channel schema.

### Dispatch flow

```
verdict produced (ECM)
  → POST /review-verdicts            (modulith owns binding resolution)
  → look up binding by (tenant, board, lane); skip if absent/disabled
  → trigger filter: ON_REJECT drops approvals
  → enqueue async_job  jobType=review_verdict_dispatch  executor=modulith
                       dedupeKey=review-dispatch:{bindingId}:{mediaId}:{verdict}
  → ModulithJobWorker claims (lease/CAS/backoff for free)
  → ReviewVerdictDispatchHandler:
        render field_templates against the payload's context snapshot
        → coerce each field to its declared type
        → IntegrationOperationInvoker.invoke(tenant, connectionId, operationId, body)
        → 2xx: SUCCEEDED · 4xx: NonRetryableJobException (park) · 5xx/timeout: throw (retry)
```

**The context is snapshotted at enqueue time** and carried in the job payload —
not re-read at execution. A retry three hours later must send the state that was
reviewed, not whatever the task looks like now. It also keeps the handler free of
ECM/Alfresco reads.

## Phases

Each phase is independently shippable and independently useful.

### Phase 1 — the operation invoker (reusable infrastructure) — **DONE**

- `CredentialAuthProvider` + `CredentialAuthRegistry` — a uniform, CDI-indexed
  face over the auth types, duplicate claim = startup failure (mirrors
  `ConnectionTesterRegistry`). Six providers ship: none, bearer, basic, api-key
  (header/query), OAuth2 client-credentials, custom-headers.
  - *Why a new interface rather than a registry over `AuthStrategy`:* a strategy
    is generic over a **typed** config record (`AuthStrategy<BearerTokenConfig>`),
    so nothing can dispatch over strategies by `AuthType` without unchecked casts
    — and building each config from a credential's two halves is per-type work
    regardless. A provider owns that construction and delegates the grant to its
    strategy, which stays untouched.
  - *No fallback provider.* An unhandled auth type raises rather than quietly
    sending the request unauthenticated.
- `ResolvedConnection` now carries `authType` / `credentialType` / `publicConfig`
  and exposes `authContext()`. A 4-arg back-compat constructor keeps the WhatsApp
  channel (which hand-builds its own auth) compiling unchanged.
- `IntegrationConnectionResolver.resolve(tenantCode, connectionId)` — the by-id
  sibling. Deliberately does **not** require `ACTIVE`: a test probe may exercise a
  `DRAFT` connection, a production dispatch may not, so the caller decides.
- `IntegrationOperationRepository.findByConnectionAndId/Name` — both scoped by
  `connection_id`, because the table has no `tenant_code` and an operation is only
  tenant-safe when reached through an already-resolved connection.
- `IntegrationOperationInvoker` — the engine. Joins `{baseUrl}{path}` (tolerating
  slashes on either side, preserving an existing query string), appends auth query
  params URL-encoded, SSRF-guards via `OutboundUrlGuard.requirePublicHttpUrl`,
  sends a JSON body only on POST/PUT/PATCH, and records the exchange through
  `JobHttpTrace` (never headers — that is where the token is).
  Timeout: `miot.integrations.operation-invoker.timeout-seconds` (default 20).
- A completed non-2xx is an `OperationInvocationResult`, not an exception —
  `retryable()` treats 5xx plus `408`/`429` as "later", every other 4xx as "never".

**Credential shapes this establishes** (the contract for creating one):

| Auth type | non-secret `publicConfig` | decrypted `secret` |
|---|---|---|
| `NONE` | — | — |
| `BEARER_TOKEN` | — | `token` |
| `BASIC` | `username` | `password` |
| `API_KEY_HEADER` / `API_KEY_QUERY` | `name` (header/param name) | `value` |
| `OAUTH2_CLIENT_CREDENTIALS` | `clientId`, `tokenUrl` \| `tenantId`+`scope`, … | `clientSecret` |
| `CUSTOM_HEADERS` | — | `headers` (object; CRLF rejected) |

**Still open from this phase:** `GenericConnectionTester` can now become a real
probe instead of a stub — not done here to keep the change reviewable.

### Phase 2 — payload rendering — **DONE**

- `PayloadTemplate` — the template language: literal text interleaved with
  `{{dotted.path}}` over `{task, content, review, session}`. A **strict subset of
  Handlebars**: blocks, helpers, partials, comments, inverted sections and
  `{{{unescaped}}}` are all **rejected**, as are unknown variable roots and a bare
  `{{task}}` (a whole object stringified into the payload is a half-typed path, not
  an intent). No HTML escaping — Jackson escapes the JSON body, and escaping here
  would corrupt it.
- `PayloadSchema` — reads `integration_operations.request_schema` as a JSON-Schema
  subset (`properties` + `required`). **This is that column's first reader.**
  Richer schemas are ignored rather than rejected; `string`/`date-time`/unknown all
  pass through as text.
- `PayloadRenderer` — render → coerce → decide, collecting **every** problem before
  throwing so a broken six-field mapping is seen in one pass. Also does the
  save-time `validate(...)` that backs the binding save and the preview endpoint.

Two behaviours worth knowing:

- **An empty optional field is omitted, not sent blank.** Partners generally treat
  an absent key and `""` differently, and "no reviewer comment" means the former.
  An empty *required* field is an error — silently writing a blank into a required
  slot is worse than failing.
- **A template that is exactly one variable keeps the context value's own type**, so
  `{{review.verdict}}` over a real boolean sends JSON `false`, not `"false"`,
  without depending on a string round-trip. Text forms (`true`/`false`/`1`/`0`) are
  still accepted; anything else is refused, because treating any non-empty string
  as true would turn a mapping slip into a wrong verdict.

**How the parity risk is actually closed:** validation runs at **save**, not
dispatch. A template the UI's Handlebars would render differently never reaches
storage, so preview and runtime cannot drift. If helpers are wanted later, add a
real Handlebars dependency and relax the validator — but do not let the two sides
diverge in the meantime.

### Phase 3 — binding schema + CRUD API — **DONE**

- Migration **`V0.6.11__create_integration_event_bindings.sql`** (0.6.10 was the head on trunk; verify
  against `origin/trunk` at the time — concurrent PRs collide only at app boot).
- `IntegrationEventBinding` record, repository, service.
- `OrgIntegrationBindingsResource`, owner-gated, under
  `/api/v1/orgs/{organizationId}/integrations/bindings`, carrying
  `@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")`
  and the `ownerWork` / tenant-resolution idiom copied verbatim.

| Method | Path | Purpose |
|---|---|---|
| GET | `/bindings?eventType=&scopeKind=` | list (UI: which scopes are bound) |
| GET | `/bindings/{id}` | one |
| PUT | `/bindings` | upsert by the unique key — matches the drawer's Save |
| DELETE | `/bindings/{id}` | unbind |
| GET | `/dispatch-targets` | **channel picker feed**: eligible connections with each dispatcher's field contract, so the UI doesn't join two endpoints |
| POST | `/bindings/preview` | render the templates against a sample context — the server-side twin of the drawer's live preview |

Reads are parent-inclusive (`owner_org_slug IN (own, parent)`); writes always
stamp the calling org, so a child can never author a binding on its parent's
behalf.

Save-time validation: connection exists and is `ACTIVE`, the dispatcher accepts
the binding (HTTP requires an `operation_id` belonging to that connection), every
`required` field in the dispatcher's contract has a non-blank template, and all
templates parse.

### Phase 4 — event intake + job handler — **DONE**

- `EventDispatchFeature` — payload key constants (house style, per
  `CalendarConfirmFeature` / `JobFailureNotificationFeature`).
- `POST /integration-events` — generic intake: `{eventType, scope, context}`.
  Resolves matching bindings, applies each one's `condition`, enqueues one job per
  surviving binding. Returns the job ids (or `204` when nothing matched).
  The review verdict is simply `eventType = "review.verdict"`.
- `IntegrationEventDispatchHandler implements ModulithJobHandler`,
  `jobType = "integration_event_dispatch"` (26 chars, fits `VARCHAR(64)`),
  `EXECUTOR = "modulith"`. Loads the binding, renders the templates against the
  payload's context snapshot, routes to the `ChannelDispatcher` for the
  connection's provider type.
- Enqueue with the `JobFailureNotifyOnPark` idiom, including
  `worker.onEnqueued(response)` for the fast-path drain.

`async_jobs` needs **no migration** — `job_type` is unconstrained text and
`payload` is free JSONB.

### Phase 5 — frontend swap (separate PR, `apps/app`)

Replace the mocked channel catalog with `/dispatch-targets`, the mocked
credential list with the real profiles, and the localStorage config with the
binding endpoints.

## Terminology: `tenant_code` is the Auth0 M2M client id

`TenantRequestFilter` resolves one value from the JWT (`aud`/`azp`, or the
`X-Client-Id` header in dev) and assigns it to both fields:

```java
tenantContext.setClientId(clientId);
tenantContext.setTenantCode(clientId);   // the same value
```

So `tenant_code` across `miot_integrations` **holds the client id**. Nothing
derives a distinct "tenant code", and the resources' `getTenantCode() != null ?
… : getClientId()` fallback is unreachable. The vestigial
`tenant_id BIGINT REFERENCES miot_core.tenants(id)` on these tables is never
written by any repository — the fossil of a tenants registry that never landed.

The org model already names this value properly:

```sql
-- miot_core.organizations
tenant_client_id VARCHAR(255) NOT NULL, -- Auth0 M2M client ID = Tenant.code
```

**Decision: standardize on `tenant_client_id` / `tenantClientId`**, matching the
org model and the name `miot-core` already uses (`HarnessProxyResource`). New
tables in this feature use it from the start.

Renaming the *existing* columns is deliberately **not** part of this feature —
see "Deferred" below. Note `client_id` was rejected as the target name: in this
module `clientId` already means the OAuth2 app-registration id
(`OAuth2CredentialConfigs.require(publicConfig, "clientId")`,
`params.put("client_id", …)`), so `credential_profiles.client_id` would sit beside
`public_config->>'clientId'` meaning something else entirely.

## Decisions

- **Reuse `ProviderType.CUSTOM_HTTP`.** A generic JSON-over-HTTP partner needs no
  new provider constant, which avoids a `chk_integration_connections_provider_type`
  CHECK migration and its rolling-deploy hazard. Add a constant only if a partner
  needs bespoke auth or response handling.
- **Intake as REST, not a direct ECM enqueue.** ECM *could* enqueue a
  `modulith`-lane job itself (it already speaks the jobs API), but then ECM owns
  binding lookup, trigger filtering and the payload contract. Keeping intake in
  the modulith means the review binding is configurable without an ECM deploy.
- **Snapshot the context at enqueue**, per the retry argument above.
- **Dedupe on `(binding, media, verdict)`** so a re-delivered verdict is a no-op
  via the existing partial unique index, not a duplicate partner call.

## Risks

- **Template parity.** The drawer previews with real Handlebars (helpers, `#if`);
  a substitution-subset backend would silently render those differently. This is
  the one place preview and runtime can diverge, so Phase 2 ships
  `TemplateValidator` and rejects unsupported constructs **on save** — a template
  that can't round-trip never reaches storage. If helpers are wanted later, add
  `com.github.jknack:handlebars` and drop the restriction; do not let the two
  sides drift in the meantime.
- **Rolling deploys.** Phase 3 is a new table only. Should any later phase add a
  column to an existing table, it needs `NOT NULL` **with a default** — the
  previous image keeps inserting without it. (`V0.6.9` shipped `NOT NULL` with no
  default and had to be repaired by `V0.6.10`.)
- **Cross-tenant leak via operations.** `integration_operations` has no
  `tenant_code`; every new query must be reached through a tenant-checked
  connection load, never by operation id alone.
- **Partner 4xx semantics.** Parking on all 4xx is right for validation errors but
  wrong for `429`/`408` — treat those as retryable.

## Deferred: renaming the existing `tenant_code` columns

Agreed to do, scoped out of this feature because it is a migration in its own
right, not a side effect of shipping dispatch. What it touches:

- **~10 tables in two schemas** — `miot_integrations` (credential_profiles,
  integration_connections, async_jobs, interaction_episodes, knowledge_candidates,
  gps_webhook_subscriptions, job_notification_rules, …) and `miot_conversational`.
- **~65 Java files** across `miot-integrations`, `miot-conversational` and
  `miot-core`. Mechanical and compiler-checked: `tenantCode` and `tenant_code` are
  distinct tokens that collide with nothing.
- **The wire contract.** Three response DTOs expose `tenantCode`
  (`CredentialProfileResponse`, `GpsWebhookResponse`, `WebhookDeliveryResponse`),
  and the app reads it — the jobs console renders `job.tenantCode`, plus the
  WhatsApp and GPS-webhook settings types. Responses should emit **both** names
  for one release so backend and frontend can deploy in either order.
- **A rolling-deploy hazard.** A bare `RENAME COLUMN` breaks the running image the
  moment Flyway applies it: old pods still query `tenant_code`. It needs
  expand/contract — add + backfill + keep in sync, switch reads, drop the old
  column in a later release — the same lesson as `V0.6.9` → `V0.6.10`.
- **Ad-hoc SQL.** db-scripts queries and any dashboards against these tables break
  silently on rename; worth a grep before the contract step.

## Scope identity and the reviewer

Two decisions that Phase 4 needed, now settled.

**A kanban lane is an Activiti task**, addressed by its task form key — so
`scope_kind = "activiti_task"`, `scope_key = "wfship2:presentDriverTask"`.

The tempting alternative, the board's display title, is wrong twice over. It is a
*derived* key (`taskShippingBoardMap` maps `wfship:transportValidationTask` →
`transportValidation`), and it is **many-to-one**: `wfship:tripOutsideInitiatedTask`
and `tripInitiatedWithoutSovos` both land on `monitoringFinalization`. Binding on
the form key is therefore both stable under renames and strictly more precise —
two workflow tasks sharing a visual lane can carry different bindings, which is
what they are.

**`session.*` is the reviewer**, not the service account that makes the outbound
call. This has a hard consequence: the producer must put the reviewer's identity
in the intake context, because dispatch happens later on a worker thread with no
user. An identity not captured at intake cannot be recovered at all — which is the
same reason the whole context is snapshotted rather than re-read.

## Open questions

1. **Verdict source of truth.** Review state currently lives as forum data on the
   document node, not `mintral:reviewStatus` — the intake contract should carry
   the verdict explicitly rather than have the modulith infer it.
2. **Per-binding retry budget.** Ride the global default (5 attempts) or make
   `max_attempts` a binding column?
