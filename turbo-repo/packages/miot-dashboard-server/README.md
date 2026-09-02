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

**P2a — HTTP layer and a runnable server.** Access control from P1 is now
reachable over HTTP, in both shapes the project supports: mount the library in
a server you already have, or run the server this package ships. The query
proxy, datasource administration and embed tokens land in later phases and all
go through the same authorization point.

## Two shapes, one codebase

Integrate into an existing backend, or run the server when there is nothing to
integrate into. Neither is a fallback for the other, and no logic is duplicated
between them.

| Layer                                 | Entry             | Assumes   |
| ------------------------------------- | ----------------- | --------- |
| Core: seams, access control           | `.`               | nothing   |
| HTTP handler: `Request` to `Response` | `./http`          | Web types |
| In-memory seams                       | `./testing`       | nothing   |
| Server: listener, probes, lifecycle   | `./server`, `bin` | Node      |

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

Outside this repo, or from a build rather than from source:

```bash
MIOT_DASHBOARD_INSECURE_AUTH=true \
MIOT_DASHBOARD_SEED=example \
  npx @microboxlabs/miot-dashboard-server
```

`PORT`, `HOST` and `MIOT_DASHBOARD_BASE_PATH` are read from the environment.
`MIOT_DASHBOARD_SEED` is a path to a JSON seed file, resolved from your working
directory; the single reserved value `example` means the one shipped with the
package, which is what makes the line above work from anywhere.

`MIOT_DASHBOARD_INSECURE_AUTH` reads the caller's identity straight from
request headers with no verification, so anyone who can reach the port can
claim to be anyone. It exists to exercise the API before an identity provider
is wired up, and the server fails closed around it in three directions: it
refuses to start under `NODE_ENV=production`, it refuses to start **on any
address but loopback** — reaching the port is being every user in every tenant,
so the port must not leave the machine — and it refuses to start without it
too, because the alternative would be starting with no authentication at all.
A verifying resolver arrives with P2b, along with a Postgres store to replace
the in-memory one.

`NODE_ENV` is not a security boundary; it is a variable nobody has to set. The
bind-address check is the one that holds either way.

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
  `src/adapters/fastify/`. Everything else runs under a bare Node process.
- No Alfresco. Alfresco is one host's `ServerDashboardStore` implementation,
  supplied from outside, never something this package knows about.

## Entries

| Entry       | Holds                                                |
| ----------- | ---------------------------------------------------- |
| `.`         | seams, access control, roles, errors                 |
| `./http`    | the fetch-shaped handler                             |
| `./testing` | in-memory seams, for dev servers and for integrators |
| `./server`  | Node listener, probes, config                        |
| `bin`       | `npx @microboxlabs/miot-dashboard-server`            |

Separate entries so that mounting the library never drags in a listener, and
running the server never drags in a framework.

The handler is written against Web standard `Request` and `Response` rather
than any framework's types. Next route handlers already speak those, so a Next
binding is a re-export rather than a translation, and no framework's version
churn reaches consumers.
