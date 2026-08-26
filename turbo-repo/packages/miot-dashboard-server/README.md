# `@microboxlabs/miot-dashboard-server`

Framework-agnostic backend services for MIOT embeddable dashboards.

`@microboxlabs/miot-dashboard-ui` renders dashboards and is deliberately
tenant-unaware. This package is why it can afford to be: persistence,
identity, tenant isolation, datasource credentials and embed tokens are
enforced here, exactly once, on the server.

A host mounts it by implementing four seams. Nothing else about the host —
its framework, its identity provider, its database — reaches this package.

## Status

**P0 — skeleton.** The four seams are declared; the services behind them land
phase by phase. A host that implements these interfaces today keeps compiling
as the package fills in.

## The seams

| Seam | Answers |
|---|---|
| `IdentityResolver` | Who is this request, and which tenant are they in? |
| `ServerDashboardStore` | Where do dashboard configs and permissions live? |
| `CredentialsVault` | What secret authenticates a query to this datasource? |
| `AuditSink` | Where does the record of who-did-what go? |

## The invariant

`tenantId` is resolved from the caller's **credential**, never from a request
path or body. A caller may name any `scopeId` they like; if it does not belong
to the tenant their credential resolves to, the request is refused.

Everything else in this package depends on that being true, and it is the
property the security review should attack first.

## Boundaries (enforced by `npm run guard`, part of `check-types`)

- No React — this is a backend. The UI package's React entries are off-limits;
  only its React-free `/schema` subpath may be imported.
- `next/*` only under `src/adapters/next/`, `fastify` only under
  `src/adapters/fastify/`. Everything else runs under a bare Node process.
- No Alfresco. Alfresco is one host's `ServerDashboardStore` implementation,
  supplied from outside, never something this package knows about.

## Planned entries

| Entry | Lands |
|---|---|
| `.` | now — seams and services |
| `./next` | P2, with the persistence strangle |
| `./fastify` | P8 |

Separate entries so mounting one framework never drags in the other.
