# Review-channel dispatch — executing a connection operation from a review verdict

**Status:** Phase 1 implemented. Phases 2–5 planned.

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

One new table. A binding attaches a reviewed column to a channel:

```sql
CREATE TABLE miot_integrations.review_channel_bindings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code     VARCHAR(128) NOT NULL,
    board_key       VARCHAR(128) NOT NULL,   -- which board
    lane_key        VARCHAR(255) NOT NULL,   -- the workflow stage (stable lane title)
    connection_id   UUID NOT NULL REFERENCES miot_integrations.integration_connections(id) ON DELETE RESTRICT,
    operation_id    UUID NOT NULL REFERENCES miot_integrations.integration_operations(id)  ON DELETE RESTRICT,
    trigger_mode    VARCHAR(32)  NOT NULL DEFAULT 'ON_REJECT',
    field_templates JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- fieldId -> template string
    enabled         BOOLEAN      NOT NULL DEFAULT false,
    active          BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by      TEXT,
    updated_by      TEXT,
    CONSTRAINT chk_review_channel_bindings_trigger CHECK (trigger_mode IN ('ON_REJECT','ON_REVIEW'))
);
CREATE UNIQUE INDEX idx_review_channel_bindings_lane
    ON miot_integrations.review_channel_bindings (tenant_code, board_key, lane_key) WHERE active;
```

`ON DELETE RESTRICT` so a connection still in use by a binding can't be deleted
out from under it — the same protection credentials already get (409 + `usedBy`).

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

### Phase 2 — payload rendering

- `PayloadTemplateRenderer` — renders `fieldId -> template` into a JSON object
  against a context `{task, content, review, session}`.
- **Engine decision: a `{{dotted.path}}` substitution subset, not full
  Handlebars.** No templating dependency exists in `quarkus-srv`, and the UI only
  emits variable tokens. See the parity risk below.
- **Type coercion** off `request_schema`: a `boolean` field must leave as JSON
  `true`, not `"true"`. Render → coerce → fail the field if it can't coerce.
- `TemplateValidator` — parses a template, rejects unsupported constructs and
  unknown variable roots, used both on binding save and by a preview endpoint.

### Phase 3 — binding schema + CRUD API

- Migration **`V0.6.11__create_review_channel_bindings.sql`** (0.6.10 is current
  head; Flyway compares numerically, so 11 > 10).
- `ReviewChannelBinding` record, repository, service.
- `OrgReviewChannelBindingsResource`, owner-gated, under
  `/api/v1/orgs/{organizationId}/integrations/review-bindings`, carrying
  `@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")`
  and the `ownerWork` / `tenantCode(organizationId)` idiom copied verbatim.

| Method | Path | Purpose |
|---|---|---|
| GET | `/review-bindings` | list (UI: which columns are reviewed) |
| GET | `/review-bindings/{id}` | one |
| PUT | `/review-bindings` | upsert by `(board, lane)` — matches the drawer's Save |
| DELETE | `/review-bindings/{id}` | unbind |
| GET | `/dispatch-targets` | **channel picker feed**: ACTIVE connections × operations, each with its parsed field contract, so the UI doesn't join two endpoints |
| POST | `/review-bindings/preview` | render the templates against a sample context — the server-side twin of the drawer's live preview |

Save-time validation: connection exists and is `ACTIVE`, operation belongs to it,
every `required` field has a non-blank template, all templates parse.

### Phase 4 — verdict intake + job handler

- `ReviewDispatchFeature` — payload key constants (house style, per
  `CalendarConfirmFeature` / `JobFailureNotificationFeature`).
- `POST /review-verdicts` — intake; resolves the binding, applies the trigger
  filter, enqueues. Returns the job id (or `204` when no binding matches).
- `ReviewVerdictDispatchHandler implements ModulithJobHandler`,
  `jobType = "review_verdict_dispatch"` (23 chars, fits `VARCHAR(64)`),
  `EXECUTOR = "modulith"`; `isReady()` false when the secret key is unconfigured.
- Enqueue with the `JobFailureNotifyOnPark` idiom, including
  `worker.onEnqueued(response)` for the fast-path drain.

`async_jobs` needs **no migration** — `job_type` is unconstrained text and
`payload` is free JSONB.

### Phase 5 — frontend swap (separate PR, `apps/app`)

Replace the mocked channel catalog with `/dispatch-targets`, the mocked
credential list with the real profiles, and the localStorage config with the
binding endpoints.

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

## Open questions

1. **Lane identity.** `lane_key` as the stable workflow-stage title is what the
   UI keys on today (`use-lane-view-state`), but titles are display strings. Is
   there a stable stage id to key on instead?
2. **Who is `session.*` at dispatch time?** The reviewer (from the verdict) or the
   service account making the outbound call? They differ, and the mapping UI
   offers both.
3. **Verdict source of truth.** Review state currently lives as forum data on the
   document node, not `mintral:reviewStatus` — the intake contract should carry
   the verdict explicitly rather than have the modulith infer it.
4. **Per-binding retry budget.** Ride the global default (5 attempts) or make
   `max_attempts` a binding column?
