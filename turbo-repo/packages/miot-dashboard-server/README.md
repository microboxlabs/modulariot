# `@microboxlabs/miot-dashboard-server`

Framework-agnostic backend services for MIOT embeddable dashboards.

`@microboxlabs/miot-dashboard-ui` renders dashboards and does not know about
tenants. This package handles that instead: saving data, verifying users,
keeping tenants separate, and securing datasource credentials and embed
tokens — all on the server, in one place.

A host plugs it in by implementing a few interfaces. The host's framework,
identity provider, and database stay outside this package.

## Two ways to use it

Mount it in your backend, or run the standalone server. Same code either way.

| Layer                                 | Entry             | Assumes   |
| ------------------------------------- | ----------------- | --------- |
| Core: interfaces, access control      | `.`               | nothing   |
| HTTP handler: `Request` to `Response` | `./http`          | Web types |
| Identity: JWT verification            | `./identity`      | Node      |
| Persistence: composite, SQL, SQLite   | `./store-sql`     | Node      |
| In-memory defaults                    | `./testing`       | nothing   |
| Server: listener, probes, docs        | `./server`, `bin` | Node      |

Import only the layer you need.

### Mounting it

```ts
import { createDashboardHandler } from "@microboxlabs/miot-dashboard-server/http";

const handle = createDashboardHandler({
  identity: myIdentityResolver,
  scopes: myScopeAuthority,
  store: myDashboardStore,
  basePath: "/api/dashboard",
});

// Next route handlers already take and return Web Request/Response:
export const GET = handle;
export const PUT = handle;
```

### Running it

**Dev mode** — from the monorepo:

```bash
npx turbo run dev:server --filter=@microboxlabs/miot-dashboard-server
```

Reloads when you change files. Serves example dashboards on port 3070.

```bash
curl -H 'x-dev-user: alice' -H 'x-dev-tenant: acme' \
  http://127.0.0.1:3070/scopes/ops/dashboards
```

**Production mode** — from the monorepo:

```bash
MIOT_DASHBOARD_INSECURE_AUTH=true MIOT_DASHBOARD_SEED=example \
  npx turbo run start --filter=@microboxlabs/miot-dashboard-server
```

Builds first, then runs the server.

**Production mode** — on its own:

```bash
MIOT_DASHBOARD_INSECURE_AUTH=true \
MIOT_DASHBOARD_SEED=example \
  npx @microboxlabs/miot-dashboard-server
```

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `PORT` | `3070` | Port to listen on |
| `HOST` | `127.0.0.1` | Address to bind |
| `MIOT_DASHBOARD_BASE_PATH` | (empty) | URL prefix for API routes |
| `MIOT_DASHBOARD_SEED` | — | Path to a seed JSON file, or `example` for bundled sample data |
| `MIOT_DASHBOARD_INSECURE_AUTH` | off | Local dev only: trust identity headers without verification |
| `MIOT_DASHBOARD_STORE` | `memory` | Where dashboards are saved: `memory` or `sqlite` |
| `MIOT_DASHBOARD_SQLITE_PATH` | `./data/dashboards.db` | Database file when store is `sqlite` |
| `MIOT_DASHBOARD_DOCUMENTS` | `inline` | Where config bytes go: `inline` or `fs` |
| `MIOT_DASHBOARD_DOCUMENTS_PATH` | `./data/documents` | Directory when documents is `fs` |
| `MIOT_DASHBOARD_ORPHAN_SWEEP_INTERVAL` | `3600` | Seconds between orphan cleanups; `0` to disable |
| `MIOT_DASHBOARD_ORPHAN_MIN_AGE` | `86400` | Minimum age in seconds before an orphan is deleted |
| `MIOT_DASHBOARD_DOCS` | on | Serve OpenAPI at `/openapi.yaml` and UI at `/docs` |
| `MIOT_DASHBOARD_SCOPES_URL` | — | Host URL for scope membership; omit to use the seed file |

JWT, ticket, and scope auth variables are listed under
[Authenticating callers](#authenticating-callers) and
[Scope membership](#scope-membership).

### Storing dashboards

`MIOT_DASHBOARD_STORE` selects the store.

| Value              | Stores data            | Requires                                |
| ------------------ | ---------------------- | --------------------------------------- |
| `memory` (default) | until the process ends | nothing                                 |
| `sqlite`           | in one file            | nothing — `node:sqlite` is part of Node |

```bash
MIOT_DASHBOARD_STORE=sqlite MIOT_DASHBOARD_SQLITE_PATH=./data/dashboards.db \
  npx turbo run dev:server --filter=@microboxlabs/miot-dashboard-server
```

When running via turbo, pass env vars on the command line — undeclared vars are
dropped.

Paths are relative to the working directory. Default database:
`data/dashboards.db` in this package (gitignored). Created on first run;
migrations run at startup. Seeds skip slugs that already exist.

Config bytes are stored separately from metadata (rows and permissions):

| Where | Config bytes live |
| ----- | ----------------- |
| `inline` (default) | In the SQLite database |
| `fs` | One file per dashboard in a directory |

```bash
MIOT_DASHBOARD_STORE=sqlite MIOT_DASHBOARD_DOCUMENTS=fs \
MIOT_DASHBOARD_DOCUMENTS_PATH=./data/documents \
  npx turbo run dev:server --filter=@microboxlabs/miot-dashboard-server
```

With `fs`, each config is `<tenant>/<uuid>.json` under the documents directory.

Leftover files from failed saves or deletes are removed at startup and on a
schedule — see `MIOT_DASHBOARD_ORPHAN_SWEEP_INTERVAL` and
`MIOT_DASHBOARD_ORPHAN_MIN_AGE` in the env table. Set the interval to `0` to
disable.

Library users: `sweepOrphanDocuments` in `./store-sql`, or `.sweep()` on the
store from `openSqliteStore`.

| Node | SQLite support |
| ---- | -------------- |
| 22.13+ | Built-in (`node:sqlite`) |
| 22.5–22.12 | Needs `--experimental-sqlite` |
| Earlier | Use `memory` store |

### Authenticating callers

The server accepts a bearer JWT in the `Authorization` header. Configure the
issuer, the audience, the claim carrying the tenant, and one key source:

```bash
MIOT_DASHBOARD_JWT_ISSUER=https://your-tenant.auth0.com/ \
MIOT_DASHBOARD_JWT_AUDIENCE=miot-dashboards \
MIOT_DASHBOARD_JWT_TENANT_CLAIM=https://your-namespace/tenant_id \
MIOT_DASHBOARD_JWT_JWKS_URL=https://your-tenant.auth0.com/.well-known/jwks.json \
  npx turbo run start --filter=@microboxlabs/miot-dashboard-server
```

| Variable                             | Is                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `MIOT_DASHBOARD_JWT_ISSUER`          | required; the `iss` the tokens carry                                    |
| `MIOT_DASHBOARD_JWT_AUDIENCE`        | required; one API identifier, or several separated by commas            |
| `MIOT_DASHBOARD_JWT_TENANT_CLAIM`    | required; the claim holding the tenant                                  |
| `MIOT_DASHBOARD_JWT_JWKS_URL`        | a key source: keys fetched from the provider (RS256)                    |
| `MIOT_DASHBOARD_JWT_PUBLIC_KEY`      | a key source: a PEM pasted into configuration (RS256)                   |
| `MIOT_DASHBOARD_JWT_SECRET`          | a key source: a shared secret, at least 32 bytes (HS256)                |
| `MIOT_DASHBOARD_JWT_USER_CLAIM`      | the claim holding the user id; defaults to `sub`                        |
| `MIOT_DASHBOARD_JWT_GROUPS_CLAIM`    | the claim holding group ids; no default, and optional                   |
| `MIOT_DASHBOARD_JWT_NAME_CLAIM`      | the claim holding a display name; defaults to `name`                    |
| `MIOT_DASHBOARD_JWT_CLOCK_TOLERANCE` | seconds of clock difference allowed on `exp`; default 30, capped at 300 |

Set exactly one key source. JWT verifies who the caller is, not scope membership — see
[Scope membership](#scope-membership).

#### Tickets

Callers can send an opaque ticket instead of a JWT. The server validates it
with the issuer; results are cached (see env table below).

```bash
MIOT_DASHBOARD_TICKET_HEADER=x-alf-ticket \
MIOT_DASHBOARD_TICKET_VALIDATE_URL=https://ecm.internal/alfresco/api/-default-/public/authentication/versions/1/tickets/-me- \
MIOT_DASHBOARD_TICKET_PRESENT_NAME=authorization \
MIOT_DASHBOARD_TICKET_PRESENT_VALUE='Basic {ticketBase64}' \
MIOT_DASHBOARD_TICKET_USER_PATH=entry.id \
MIOT_DASHBOARD_TICKET_TENANT=acme \
  npx turbo run start --filter=@microboxlabs/miot-dashboard-server
```

| Variable                                | Is                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `MIOT_DASHBOARD_TICKET_HEADER`          | required; the request header callers present the ticket in                                     |
| `MIOT_DASHBOARD_TICKET_VALIDATE_URL`    | required; the emitter's endpoint, over `{ticket}` / `{ticketBase64}`                           |
| `MIOT_DASHBOARD_TICKET_VALIDATE_METHOD` | `GET` (default) or `POST`; `POST` is the default when presenting in the body                   |
| `MIOT_DASHBOARD_TICKET_USER_PATH`       | required; dotted path to the user id in the answer                                             |
| `MIOT_DASHBOARD_TICKET_TENANT`          | the single tenant this emitter serves                                                          |
| `MIOT_DASHBOARD_TICKET_TENANT_PATH`     | or: dotted path to the tenant in the answer. Exactly one of the two                            |
| `MIOT_DASHBOARD_TICKET_SCHEME`          | a scheme prefix to strip, for a header holding `Ticket <value>`                                |
| `MIOT_DASHBOARD_TICKET_PRESENT`         | `header` (default), `query` or `body`                                                          |
| `MIOT_DASHBOARD_TICKET_PRESENT_NAME`    | the header or query parameter the emitter reads it from                                        |
| `MIOT_DASHBOARD_TICKET_PRESENT_VALUE`   | header value template, e.g. `Basic {ticketBase64}`                                             |
| `MIOT_DASHBOARD_TICKET_SERVICE_HEADER`  | a credential of this server's own, sent as well as the ticket (name)                           |
| `MIOT_DASHBOARD_TICKET_SERVICE_VALUE`   | its value                                                                                      |
| `MIOT_DASHBOARD_TICKET_GROUPS_PATH`     | dotted path to group ids in the answer                                                         |
| `MIOT_DASHBOARD_TICKET_NAME_PATH`       | dotted path to a display name                                                                  |
| `MIOT_DASHBOARD_TICKET_INVALID_STATUS`  | statuses meaning "not valid"; default `401,404`, and required when a service credential is set |
| `MIOT_DASHBOARD_TICKET_CACHE`           | seconds a validated ticket is reused; default 60                                               |
| `MIOT_DASHBOARD_TICKET_NEGATIVE_CACHE`  | seconds a rejection is reused; default 30                                                      |
| `MIOT_DASHBOARD_TICKET_TIMEOUT`         | milliseconds to wait for the emitter; default 5000                                             |

JWT and ticket auth can run together — they read different headers.

Cached tickets stay valid until the cache expires (`MIOT_DASHBOARD_TICKET_CACHE`;
set to `0` to validate every request). If the issuer is unreachable, the server
returns `500`, not `401`.

#### Local dev only

Set `MIOT_DASHBOARD_INSECURE_AUTH=true` to trust identity headers without
verification — for testing before an identity provider is wired up.

The server refuses to start if `NODE_ENV=production`, if `HOST` is not
loopback, or if JWT/ticket variables are also set.

### Scope membership

Auth proves who the caller is, not which scopes they can access. Set
`MIOT_DASHBOARD_SCOPES_URL` to ask the host's membership service; omit it to
use the seed file (dev and tests only).

```bash
MIOT_DASHBOARD_SCOPES_URL='https://ecm.internal/alfresco/api/-default-/public/alfresco/versions/1/people/{userId}/sites/{scopeId}' \
MIOT_DASHBOARD_SCOPES_ROLE_PATH=entry.role \
MIOT_DASHBOARD_SCOPES_ROLE_MAP='SiteManager=Coordinator,SiteCollaborator=Editor,SiteContributor=Contributor,SiteConsumer=Consumer' \
MIOT_DASHBOARD_SCOPES_SERVICE_HEADER=authorization \
MIOT_DASHBOARD_SCOPES_SERVICE_VALUE="Basic $ECM_SERVICE_CREDENTIAL" \
  npx turbo run start --filter=@microboxlabs/miot-dashboard-server
```

| Variable                               | Is                                                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `MIOT_DASHBOARD_SCOPES_URL`            | the membership endpoint, over `{tenantId}` `{scopeId}` `{userId}`; a `GET` must place `{userId}` and `{scopeId}` |
| `MIOT_DASHBOARD_SCOPES_METHOD`         | `GET` (default) or `POST`, which sends the question as a JSON body                                               |
| `MIOT_DASHBOARD_SCOPES_ROLE_PATH`      | dotted path to the role in the answer; default `role`                                                            |
| `MIOT_DASHBOARD_SCOPES_ROLE_MAP`       | `<host role>=<role>` pairs; without it the answer must already be a role                                         |
| `MIOT_DASHBOARD_SCOPES_SERVICE_HEADER` | this server's credential for asking about other people (name)                                                    |
| `MIOT_DASHBOARD_SCOPES_SERVICE_VALUE`  | its value                                                                                                        |
| `MIOT_DASHBOARD_SCOPES_ABSENT_STATUS`  | statuses meaning "not a member"; default `404`                                                                   |
| `MIOT_DASHBOARD_SCOPES_CACHE`          | seconds a membership is reused; default 60                                                                       |
| `MIOT_DASHBOARD_SCOPES_NEGATIVE_CACHE` | seconds a non-membership is reused; default 30                                                                   |
| `MIOT_DASHBOARD_SCOPES_TIMEOUT`        | milliseconds to wait; default 5000                                                                               |

Per-dashboard permissions stay in this server's store. Cached results follow
`MIOT_DASHBOARD_SCOPES_CACHE` and `MIOT_DASHBOARD_SCOPES_NEGATIVE_CACHE`. A
host `401` means this server's credential failed — not "not a member".

### Try the API

| Path            | Is                                                              |
| --------------- | --------------------------------------------------------------- |
| `/openapi.yaml` | OpenAPI spec                                                    |
| `/docs`         | Swagger UI — authorize with dev user/tenant headers to try it |

For automated coverage, `rest-api/` is a Bruno collection (auth and tenant
isolation failures):

```bash
npx turbo run test:api --filter=@microboxlabs/miot-dashboard-server
```

Start the dev server first (port 3070). Run via turbo — Bruno needs the
collection root.

## What the host provides

When you mount the library, your app implements these interfaces. The
standalone server uses in-memory defaults from `./testing` (dev only).

| Interface              | Your app answers                                           |
| ---------------------- | ---------------------------------------------------------- |
| `IdentityResolver`     | Who is calling, and which tenant?                          |
| `ScopeAuthority`       | What role does this user have in the requested scope?      |
| `ServerDashboardStore` | Where are dashboard configs and permissions stored?        |
| `CredentialsVault`     | What secret authenticates a datasource query?              |
| `AuditSink`            | Where do audit logs go?                                    |
| `CapabilityPolicy`     | Optional — how roles map to capabilities                   |

**Tenant rule:** `tenantId` always comes from the credential, never from the
URL or request body. A caller cannot access another tenant by changing
`scopeId` in the path.

## Access control

```ts
const access = createAccessControl({
  identity: myIdentityResolver,
  scopes: myScopeAuthority,
  store: myDashboardStore,
  audit: myAuditSink, // optional
});

const decision = await access.authorize(request, {
  scopeId,
  slug,
  action: "dashboard.save",
});
// decision.dashboard.capabilities, .record, .ref — or a DashboardServerError
```

`authorize` checks in order:

1. **Identity** — no credential → `401`
2. **Scope** — not a member → `403` (`TENANT_SCOPE`)
3. **Dashboard** — load record, compute capabilities
4. **Action** — missing capability → `403` (`CAPABILITY`)

Denials are audited. Embed tokens are read-only and locked to one dashboard
(`403` `EMBED_SCOPE` otherwise).

`access.capabilities(request, scopeId, slug)` tells an embed host what the
caller can do.

### Roles

| Role          | Can do                                           |
| ------------- | ------------------------------------------------ |
| `Consumer`    | View                                             |
| `Contributor` | View; edit own dashboards; create in scope     |
| `Editor`      | Edit, share                                      |
| `Coordinator` | Full access, including delete and permissions  |

Override with a custom `CapabilityPolicy` if your role model differs. A policy
can only restrict, never grant more than the identity allows.

### Errors

One envelope, from every adapter:

```json
{ "error": "…", "status": 403, "code": "FORBIDDEN", "reason": "TENANT_SCOPE" }
```

`reason` is present on `403` only. Foreign exceptions are reduced to a generic
`500`; their messages never reach the wire. See `contract/openapi.yaml`.

## Boundaries (enforced by `npm run guard`, part of `check-types`)

- No React — this is a backend. The UI package's React entries are off-limits;
  only its React-free `/schema` subpath may be imported.
- `next/*` only under `src/adapters/next/`, `fastify` only under
  `src/adapters/fastify/`, `swagger-ui-dist` only under `src/server/`,
  `node:sqlite` only under `src/store/`, `node:crypto` only under
  `src/identity/`. Everything else runs under a bare Node process, with nothing
  optional installed.
- `node:sqlite` is loaded with `createRequire`, never a static import: esbuild
  does not list `sqlite` among Node's built-in modules, so it removes the prefix
  and emits `from "sqlite"`, which fails to resolve. The guard rejects the
  static form because the tests import the TypeScript source and do not detect
  it.
