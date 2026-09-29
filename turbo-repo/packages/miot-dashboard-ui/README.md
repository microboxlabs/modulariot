# @microboxlabs/miot-dashboard-ui

Dashboard layout utilities and a portable HTTP client, using the types and schemas
from `@microboxlabs/miot-dashboard-contract`. The package exports `./core` and `./client`;
it does not yet export a dashboard renderer or editor. This workspace version is
unreleased.

## Grid sizing

```ts
import { computeGridSizing } from "@microboxlabs/miot-dashboard-ui/core";

const sizing = computeGridSizing({ containerWidth: 1200, usedCols: 24 });
// { cols: 24, designWidth: 1600, scale: 0.75, offsetLeft: 0 }
```

`computeGridSizing({ containerWidth, usedCols }): GridSizing` computes the visual
grid dimensions without changing persisted widget coordinates. Width is measured
in pixels; `usedCols` is the greatest `x + w` of the widgets. For an unmeasured
container (width at or below zero), scale remains 1. The visual scale is capped
at the exported `MAX_SCALE` (1.35). Inputs must be finite numbers.

```ts
interface GridSizing {
  cols: number;
  designWidth: number;
  scale: number;
  offsetLeft: number;
}
```

## New widget position

`getNextPosition(siblings, width = 1): { x: number; y: number }` places a widget
after the occupied columns in the deepest occupied row, or below that row if it
does not fit. Siblings need only the shared `Widget.layout` shape. The function
does not mutate its input. Positions and sizes must be valid document grid units.

## Runtime and compatibility

The ESM `./core` entry is usable in browsers and Node.js without React, Next.js,
DOM globals or the dashboard server runtime. It depends on the shared contract
version `^0.5.0`; it does not define another document schema. Only documented
package exports are supported import paths.

## Dashboard server client

The `./client` entry uses standard Fetch APIs (modern browsers or Node.js 22+).
It contains no framework, login flow, credential vault, or query executor.

```ts
import {
  createDashboardClient,
  createDashboardRoutes,
} from "@microboxlabs/miot-dashboard-ui/client";

const client = createDashboardClient({
  routes: createDashboardRoutes({
    baseUrl: "https://dashboards.example.com",
    tenantId: "acme",
    scopeId: "operations",
  }),
  getToken: async (signal) => hostAuth.getAccessToken({ signal }),
});
const { config, etag } = await client.load("costs");
if (config) await client.save("costs", config, etag);
```

`hostAuth` represents your host's authentication service. `getToken` is optional,
called for every request, and returns `Promise<string | null>`. The client never
stores tokens. Keep signing keys, datasource credentials, SQL execution and
authorization decisions on the server. Only give the client trusted endpoints.

For an existing same-origin proxy, provide `routes: { dashboards,
scopeCapabilities }` directly and `credentials: "same-origin"`. Routes may be
HTTP(S) URLs or paths starting with `/`; resource suffixes are inserted before
any query string. The standalone route helper accepts a base URL/path without a
query and encodes tenant/scope identifiers. Cookie credentials default to `omit`.
Custom `fetch` is supported. All requests disable HTTP caching and reject redirects.
Cross-origin servers must allow the host origin, Authorization, Content-Type and
If-Match headers and expose ETag in their CORS policy.

| Method                                       | Result                                          |
| -------------------------------------------- | ----------------------------------------------- |
| `list(signal?)`                              | Array of `{ slug, name }`                       |
| `scopeCapabilities(signal?)`                 | `{ canCreate }`                                 |
| `load(slug, signal?)`                        | `{ config, etag }`; absent config is `null`     |
| `save(slug, config, etag, signal?)`          | `{ revision, updatedAt, etag }`                 |
| `query(slug, queryId, filters?, signal?)`    | Scalar-valued result rows                       |
| `capabilities(slug, signal?)`                | Read/edit/share/manage-permissions/delete flags |
| `permissions(slug, signal?)`                 | `{ assignments: [{ authorityId, role }] }`      |
| `setPermissions(slug, assignments, signal?)` | No return value                                 |
| `remove(slug, signal?)`                      | No return value                                 |

Save requires a quoted numeric ETag from load (including `"0"` for an absent
document). Conflicts are returned to the host without retrying or overwriting its
edits. `DashboardApiError.status` carries HTTP failures; invalid responses and
transport failures become 502, authentication-provider failures become 401, and
invalid routes become 400. Error messages exclude upstream bodies and provider
details. Caller cancellation remains a cancellation error.

`key(slug?)` and `scopeKey` expose scoped resource URLs for host caches. They are
not session identifiers: hosts must clear or partition cached data on identity
changes and cancel outstanding requests. The client has no application cache.
