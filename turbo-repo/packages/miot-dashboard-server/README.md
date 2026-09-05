# `@microboxlabs/miot-dashboard-server`

Framework-agnostic backend services for MIOT embeddable dashboards.

`@microboxlabs/miot-dashboard-ui` renders dashboards and is deliberately
tenant-unaware. This package is why it can afford to be: persistence,
identity, tenant isolation, datasource credentials and embed tokens are
enforced here, exactly once, on the server.

A host mounts it by implementing a handful of seams. Nothing else about the
host — its framework, its identity provider, its database — reaches this
package.

## Status

**P2b — the server persists dashboards, verifies who is asking, and asks the
host what they may see.** Access control from P1 is reachable over HTTP in both
shapes the project supports: mount the library in a server you already have, or
run the server this package ships. Dashboards survive a restart. Callers
authenticate with a bearer JWT or with a ticket their emitter validates, rather
than with a header nobody checks, and scope membership comes from the host's
own membership service rather than from a file. What is still missing before a
deployment: a PostgreSQL store for running more than one instance, and CORS for
a front-end on another origin. The query proxy, datasource administration and
embed tokens land in later phases and all go through the same authorization
point.

## Two shapes, one codebase

Integrate into an existing backend, or run the server when there is nothing to
integrate into. Neither is a fallback for the other, and no logic is duplicated
between them.

| Layer                                 | Entry             | Assumes   |
| ------------------------------------- | ----------------- | --------- |
| Core: seams, access control           | `.`               | nothing   |
| HTTP handler: `Request` to `Response` | `./http`          | Web types |
| Identity: JWT verification            | `./identity`      | Node      |
| Persistence: composite, SQL, SQLite   | `./store-sql`     | Node      |
| In-memory seams                       | `./testing`       | nothing   |
| Server: listener, probes, docs        | `./server`, `bin` | Node      |

Each layer is usable without the one below it in this table. A host that mounts
the handler never pulls in a listener; a standalone deployment never pulls in a
framework.

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

From anywhere in the monorepo, as a turbo task. This reloads on change and
starts with the example seed on port 3070:

```bash
npx turbo run dev:server --filter=@microboxlabs/miot-dashboard-server
```

```bash
curl -H 'x-dev-user: alice' -H 'x-dev-tenant: acme' \
  http://127.0.0.1:3070/scopes/ops/dashboards
```

To run the built output rather than the source, which is what a deployment
runs. `start` depends on `build`, so this compiles first:

```bash
MIOT_DASHBOARD_INSECURE_AUTH=true MIOT_DASHBOARD_SEED=example \
  npx turbo run start --filter=@microboxlabs/miot-dashboard-server
```

Outside this repo:

```bash
MIOT_DASHBOARD_INSECURE_AUTH=true \
MIOT_DASHBOARD_SEED=example \
  npx @microboxlabs/miot-dashboard-server
```

`PORT`, `HOST` and `MIOT_DASHBOARD_BASE_PATH` are read from the environment.
`MIOT_DASHBOARD_SEED` is a path to a JSON seed file, resolved from your working
directory; the single reserved value `example` means the one shipped with the
package, which is what makes the line above work from anywhere.

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

Turborepo runs tasks with a filtered environment, so a variable the task does
not declare is removed rather than passed on — and the server would start with
the default store without saying why. `dev:server`, `start` and `test:api`
declare `MIOT_DASHBOARD_*`, `PORT` and `HOST` in `passThroughEnv` for that
reason. The startup line names the store it opened, which is the quickest way
to see that a setting arrived.

The path is relative to the working directory, which for a turbo task is this
package: the default puts the database at
`turbo-repo/packages/miot-dashboard-server/data/dashboards.db`. That directory
is gitignored, because a database holding real dashboards must not reach this
repository.

The file and its parent directories are created on first run, and migrations
run on every start, applying only what that database has not recorded. A seed
writes a dashboard only if its slug is absent, so it does not overwrite edits
made since the last start.

The store is built from two parts: a **metadata** database holding a row per
dashboard and its permissions, and a **document** store holding the config
bytes. A save writes the config under a new key and then updates the row to
point at it, so a read never sees a partly written dashboard and the document
store needs no locking. `MIOT_DASHBOARD_DOCUMENTS` selects where the bytes go.

| Value              | Stores configs                          |
| ------------------ | --------------------------------------- |
| `inline` (default) | in the sqlite database, beside the rows |
| `fs`               | one file per document under a directory |

```bash
MIOT_DASHBOARD_STORE=sqlite MIOT_DASHBOARD_DOCUMENTS=fs \
MIOT_DASHBOARD_DOCUMENTS_PATH=./data/documents \
  npx turbo run dev:server --filter=@microboxlabs/miot-dashboard-server
```

Files are named `<tenant>/<uuid>.json`. The tenant id is percent-encoded and
nothing else the caller supplies appears in the path, and a key the database
hands back that is not a path under the directory is refused rather than
opened. Each file is written once, so a directory served by a network
filesystem needs no lock.

A save that loses its race, a process that dies between its two writes, or a
delete that fails leaves a document nothing references. An **orphan sweep**
runs at start and then every `MIOT_DASHBOARD_ORPHAN_SWEEP_INTERVAL` seconds
(default 3600; `0` disables it), deleting unreferenced documents older than
`MIOT_DASHBOARD_ORPHAN_MIN_AGE` seconds (default 86400). Anything younger is
left alone, because a save holds its document unreferenced for a moment
before the row commits. The age limit is also how long a replaced config
stays on disk, so it doubles as a retention policy. Documents the `inline`
backend wrote before this version have no recorded age and are never swept.
Each run logs one line with what it deleted, kept and could not delete.

Library users get the same from `sweepOrphanDocuments` in `./store-sql`, or
from `sweep` on the object `openSqliteStore` returns.

`node:sqlite` runs without a flag from Node 22.13; from 22.5 it needed
`--experimental-sqlite`. On earlier versions the server reports that and names
the alternative store.

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

Exactly one key source. **The algorithm is not configurable** — it follows from
the key source, because a verifier that accepts both RS256 and HS256 can be
defeated: the RS256 public key is published, and an attacker signs an HS256
token using it as the shared secret. Deriving the algorithm from the key source
means "accept either" cannot be configured. This is the one part of
verification a library does not decide: `jose` accepts any algorithm the key
supports unless it is told which one to allow.

Five things to know before deploying it:

- **`jose` has to be installed.** Verification is delegated to it, and it is an
  optional peer dependency so that a host mounting the library with its own
  identity resolver installs nothing: `npm install jose`. If it is missing the
  server reports that and exits, rather than starting and refusing every
  request.
- **The issuer is compared exactly**, trailing slash included, as OpenID
  Connect requires: a rule that treats two spellings as equal treats two
  different issuers as equal. Auth0 publishes its issuer _with_ the slash, so
  copy it from a token rather than typing it.
- **There is no default tenant claim.** No registered claim carries a tenant
  and every provider uses a different name, so a default would put every caller
  in the same tenant without any error. For Auth0 this is a namespaced custom
  claim that an Action has to add; a stock token does not carry one.
- **A pasted key needs no egress.** `MIOT_DASHBOARD_JWT_PUBLIC_KEY` verifies
  the same tokens without reaching the identity provider, which is what a
  cluster with no outbound access needs. It has to be replaced by hand when the
  provider rotates.
- **Identity is not membership.** Verifying a token establishes who the caller
  is and which tenant they are in. Which scopes they belong to is a separate
  question, answered by the `ScopeAuthority` seam — see
  [Scope membership](#scope-membership) below. Started with a verified issuer
  and neither a seed nor a membership URL, every request is a `403`, and the
  server says so at startup.

A refused credential is a `401` with no detail. The reason is logged instead,
so that a misconfiguration can be diagnosed:

```json
{ "level": "warn", "msg": "credential refused", "reason": "token has expired" }
```

#### Tickets

Where callers hold an opaque ticket rather than a token, the server validates
it against whoever issued it. A ticket carries no proof of its own, so this is
one call to the emitter per ticket per cache interval.

```bash
MIOT_DASHBOARD_TICKET_HEADER=x-alf-ticket \
MIOT_DASHBOARD_TICKET_VALIDATE_URL=https://ecm.internal/alfresco/api/-default-/public/authentication/versions/1/tickets/-me- \
MIOT_DASHBOARD_TICKET_PRESENT_NAME=authorization \
MIOT_DASHBOARD_TICKET_PRESENT_VALUE='Basic {ticketBase64}' \
MIOT_DASHBOARD_TICKET_USER_PATH=entry.id \
MIOT_DASHBOARD_TICKET_TENANT=acme \
  npx turbo run start --filter=@microboxlabs/miot-dashboard-server
```

| Variable                               | Is                                                                   |
| -------------------------------------- | -------------------------------------------------------------------- |
| `MIOT_DASHBOARD_TICKET_HEADER`         | required; the request header callers present the ticket in           |
| `MIOT_DASHBOARD_TICKET_VALIDATE_URL`   | required; the emitter's endpoint, over `{ticket}` / `{ticketBase64}` |
| `MIOT_DASHBOARD_TICKET_USER_PATH`      | required; dotted path to the user id in the answer                   |
| `MIOT_DASHBOARD_TICKET_TENANT`         | the single tenant this emitter serves                                |
| `MIOT_DASHBOARD_TICKET_TENANT_PATH`    | or: dotted path to the tenant in the answer. Exactly one of the two  |
| `MIOT_DASHBOARD_TICKET_SCHEME`         | a scheme prefix to strip, for a header holding `Ticket <value>`      |
| `MIOT_DASHBOARD_TICKET_PRESENT`        | `header` (default), `query` or `body`                                |
| `MIOT_DASHBOARD_TICKET_PRESENT_NAME`   | the header or query parameter the emitter reads it from              |
| `MIOT_DASHBOARD_TICKET_PRESENT_VALUE`  | header value template, e.g. `Basic {ticketBase64}`                   |
| `MIOT_DASHBOARD_TICKET_SERVICE_HEADER` | a credential of this server's own, sent as well as the ticket (name) |
| `MIOT_DASHBOARD_TICKET_SERVICE_VALUE`  | its value                                                            |
| `MIOT_DASHBOARD_TICKET_GROUPS_PATH`    | dotted path to group ids in the answer                               |
| `MIOT_DASHBOARD_TICKET_NAME_PATH`      | dotted path to a display name                                        |
| `MIOT_DASHBOARD_TICKET_INVALID_STATUS` | statuses meaning "not valid"; default `401,404`                      |
| `MIOT_DASHBOARD_TICKET_CACHE`          | seconds a validated ticket is reused; default 60                     |
| `MIOT_DASHBOARD_TICKET_NEGATIVE_CACHE` | seconds a rejection is reused; default 30                            |
| `MIOT_DASHBOARD_TICKET_TIMEOUT`        | milliseconds to wait for the emitter; default 5000                   |

Worth knowing:

- **Both schemes can run at once.** They read different headers, so a
  deployment facing a front-end with tokens and a service with tickets
  configures both and neither shadows the other.
- **The tenant has no default**, for the reason it has none for JWTs. Set
  `MIOT_DASHBOARD_TICKET_TENANT` where the emitter serves one tenant, or
  `MIOT_DASHBOARD_TICKET_TENANT_PATH` to read it from the answer.
- **The cache interval is how long a revoked ticket keeps working.** Sixty
  seconds by default. Lower it where that matters more than the load on the
  emitter; `0` validates on every request.
- **An unreachable emitter is a `500`, not a `401`.** The two are different
  facts, and reporting an outage as a refusal makes a broken server look like a
  working one that has locked everybody out.

#### The development alternative

`MIOT_DASHBOARD_INSECURE_AUTH` reads the caller's identity straight from
request headers with no verification, so anyone who can reach the port can
claim to be anyone. It exists to exercise the API before an identity provider
is wired up, and the server fails closed around it in three directions: it
refuses to start under `NODE_ENV=production`, it refuses to start **on any
address but loopback** — reaching the port is being every user in every tenant,
so the port must not leave the machine — and it refuses to start alongside any
verified scheme's variables, because a server that silently preferred one would
be checking credentials in one environment and trusting headers in another.

`NODE_ENV` is not a security boundary; it is a variable nobody has to set. The
bind-address check is the one that holds either way.

### Scope membership

Verifying a credential says who the caller is. It does not say which scopes
they may see, and this server does not keep that list: the host already has
one. Point it at the host's own membership service and it asks, caching the
answer briefly.

```bash
MIOT_DASHBOARD_SCOPES_URL='https://ecm.internal/alfresco/api/-default-/public/alfresco/versions/1/people/{userId}/sites/{scopeId}' \
MIOT_DASHBOARD_SCOPES_ROLE_PATH=entry.role \
MIOT_DASHBOARD_SCOPES_ROLE_MAP='SiteManager=Coordinator,SiteCollaborator=Editor,SiteContributor=Contributor,SiteConsumer=Consumer' \
MIOT_DASHBOARD_SCOPES_SERVICE_HEADER=authorization \
MIOT_DASHBOARD_SCOPES_SERVICE_VALUE="Basic $ECM_SERVICE_CREDENTIAL" \
  npx turbo run start --filter=@microboxlabs/miot-dashboard-server
```

| Variable                               | Is                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `MIOT_DASHBOARD_SCOPES_URL`            | the membership endpoint, over `{tenantId}` `{scopeId}` `{userId}`        |
| `MIOT_DASHBOARD_SCOPES_METHOD`         | `GET` (default) or `POST`, which sends the question as a JSON body       |
| `MIOT_DASHBOARD_SCOPES_ROLE_PATH`      | dotted path to the role in the answer; default `role`                    |
| `MIOT_DASHBOARD_SCOPES_ROLE_MAP`       | `<host role>=<role>` pairs; without it the answer must already be a role |
| `MIOT_DASHBOARD_SCOPES_SERVICE_HEADER` | this server's credential for asking about other people (name)            |
| `MIOT_DASHBOARD_SCOPES_SERVICE_VALUE`  | its value                                                                |
| `MIOT_DASHBOARD_SCOPES_ABSENT_STATUS`  | statuses meaning "not a member"; default `404`                           |
| `MIOT_DASHBOARD_SCOPES_CACHE`          | seconds a membership is reused; default 60                               |
| `MIOT_DASHBOARD_SCOPES_NEGATIVE_CACHE` | seconds a non-membership is reused; default 30                           |
| `MIOT_DASHBOARD_SCOPES_TIMEOUT`        | milliseconds to wait; default 5000                                       |

Worth knowing:

- **Only scope membership is delegated.** Per-dashboard permission assignments
  stay in this server's own store, because a dashboard is a row here with
  nothing in the host to hang an access list on. The `authorityId` on an
  assignment is still a host group id, so the two fit together.
- **The two cache settings are different risks.** How long a membership is
  reused is how long a revoked member keeps working; how long a non-membership
  is reused is how long a new member waits.
- **`401` from the host is an error, not a denial.** It means this server's own
  credential was refused, and reading that as "not a member" would deny every
  caller while looking healthy. Only the statuses in
  `MIOT_DASHBOARD_SCOPES_ABSENT_STATUS` mean no.
- **Without a URL, membership comes from the seed file.** That is right for a
  demo and for the tests, and wrong for a deployment, where nobody maintains
  it.

### Reading it

The standalone server publishes its own contract:

| Path            | Is                                            |
| --------------- | --------------------------------------------- |
| `/openapi.yaml` | `contract/openapi.yaml`, served byte for byte |
| `/docs`         | that document, rendered with Swagger UI       |

The page has "Try it out" wired up, and the spec declares the two development
headers as security schemes, so **Authorize** with a user and a tenant is
enough to drive the whole API from the browser against a seeded dev server.
Set `MIOT_DASHBOARD_DOCS=false` to serve neither.

Swagger UI's assets are an **optional** dependency and are never loaded from a
CDN — a dashboard server inside a cluster with no egress has to be able to
render its own documentation, and a page that quietly fetches 1.5 MB from a
third party is not something to hide in a docs route. The trade is that
`/docs` needs `swagger-ui-dist` installed alongside the package:

```bash
npm install swagger-ui-dist
```

Without it `/openapi.yaml` still works and `/docs` says exactly that. In this
repository it is already a dev dependency, so the turbo task above renders.

The document and the router are held together by
`src/server/docs.test.ts`, which probes every path and method in both
directions: a documented operation the router does not serve fails, and a
served operation the document omits fails too. That check exists because the
contract spent P1 describing one of the seven operations, and rendering a
stale document is worse than not rendering one.

### Exercising it

`rest-api/` is a Bruno collection covering the whole surface, including the
cases worth seeing fail: an unauthenticated call, a cross-tenant probe, a
Consumer's write, a stale revision.

```bash
npx turbo run test:api --filter=@microboxlabs/miot-dashboard-server
```

Run it against the seeded dev server above; both default to port 3070. The
seed puts a dashboard at the same scope and slug in two different tenants, so
an isolation mistake shows up as a failing assertion rather than as a subtle
bug.

The collection carries its own `package.json`, and it is load-bearing: `npx`
resets the working directory to the nearest one, and the Bruno CLI resolves
the collection from the working directory. Without it the run fails with "You
can run only at the root of a collection" even though the collection file is
right there.

## The seams

A host mounting the library implements these. The standalone server supplies
in-memory defaults from `./testing`, which are for development only.

| Seam                   | Answers                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `IdentityResolver`     | Who is this request, and which tenant are they in?           |
| `ScopeAuthority`       | What is this identity's role in the scope the request names? |
| `ServerDashboardStore` | Where do dashboard configs and permissions live?             |
| `CredentialsVault`     | What secret authenticates a query to this datasource?        |
| `AuditSink`            | Where does the record of who-did-what go?                    |
| `CapabilityPolicy`     | Optional. How do role assignments become capabilities?       |

## The invariant

`tenantId` is resolved from the caller's **credential**, never from a request
path or body. A caller may name any `scopeId` they like; if it does not belong
to the tenant their credential resolves to, the request is refused.

Everything else in this package depends on that being true, and it is the
property the security review should attack first.

## Access control

```ts
const access = createAccessControl({
  identity: myIdentityResolver, // credential → { userId, tenantId, ... }
  scopes: myScopeAuthority, // (identity, scopeId) → role | null
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

`authorize` runs in a fixed order, and the order is the guarantee:

1. **Identity** from the credential. None → `401`.
2. **Scope**: the URL's `scopeId` is checked against that identity through
   `ScopeAuthority`. No standing → `403` with reason `TENANT_SCOPE`. No store
   call has happened yet, so the answer is the same whether the scope belongs
   to another tenant, does not exist, or the caller simply is not a member.
3. **Dashboard** (when the target names one): record and assignments are
   loaded under the credential's tenant, the `CapabilityPolicy` turns them
   into capabilities, and the identity's ceiling is intersected on top.
4. **Action**: the capability the action needs. Missing → `403` with reason
   `CAPABILITY`.

Every decision is audited, denials included. An embed principal may only
load the one dashboard its token names and run its queries, read-only; any
other target or action is `403` with reason `EMBED_SCOPE`.

`access.capabilities(request, scopeId, slug)` is the server half of the UI
package's Seam F — the endpoint an embed host calls to learn what to render.

### Roles

| Role          | Default capabilities                                |
| ------------- | --------------------------------------------------- |
| `Consumer`    | view                                                |
| `Contributor` | view; edit dashboards they created; create in scope |
| `Editor`      | edit, share                                         |
| `Coordinator` | everything, including delete and permissions        |

The mapping is the default `CapabilityPolicy`; a host with a different model
supplies its own. A policy can narrow, never widen past the identity's
ceiling.

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
- No Alfresco. Alfresco is one host's `ServerDashboardStore` implementation,
  supplied from outside, never something this package knows about.

## Entries

| Entry         | Holds                                                                    |
| ------------- | ------------------------------------------------------------------------ |
| `.`           | seams, access control, roles, errors                                     |
| `./http`      | the fetch-shaped handler                                                 |
| `./identity`  | JWT verification, key rings, the verifying resolver                      |
| `./store-sql` | composite store, SQL metadata, SQLite driver, fs documents, orphan sweep |
| `./testing`   | in-memory seams, for dev servers and for integrators                     |
| `./server`    | Node listener, probes, config, contract and docs                         |
| `bin`         | `npx @microboxlabs/miot-dashboard-server`                                |

Separate entries so that mounting the library never drags in a listener, and
running the server never drags in a framework.

The handler is written against Web standard `Request` and `Response` rather
than any framework's types. Next route handlers already speak those, so a Next
binding is a re-export rather than a translation, and no framework's version
churn reaches consumers.
