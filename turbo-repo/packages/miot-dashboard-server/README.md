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

**P1 — access control.** The seams are declared and the first service behind
them is in: `createAccessControl`, the single point where identity, tenancy
and capabilities are enforced. Persistence, the query proxy and embed tokens
land in later phases and all go through it.

## The seams

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

## Planned entries

| Entry       | Lands                                                                          |
| ----------- | ------------------------------------------------------------------------------ |
| `.`         | now — seams and access control; other services land behind them phase by phase |
| `./next`    | P2, with the persistence strangle                                              |
| `./fastify` | P8                                                                             |

Separate entries so mounting one framework never drags in the other.
