# @microboxlabs/miot-dashboard-ui

Dashboard layout utilities and a portable HTTP client, using the types and schemas
from `@microboxlabs/miot-dashboard-contract`. The package exports `./core`, `./client` and `./document`;
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

## Widget registry

`createWidgetRegistry(definitions)` from `./core` creates a separate catalog for
each host. Definitions are host-owned immutable objects with a `meta.id` string;
the registry preserves their other fields and types, without importing React or
any widgets. Duplicate or blank IDs throw during construction. There is no
global registration or implicit override.

```ts
import { createWidgetRegistry } from "@microboxlabs/miot-dashboard-ui/core";

const catalog = createWidgetRegistry([
  { meta: { id: "cost-card" }, format: (value: number) => `$${value}` },
]);
catalog.get("cost-card")?.format(12); // "$12"
catalog.get("unknown"); // undefined
catalog.all(); // independent array in registration order
```

`WidgetRegistry<Definition>` exposes `get(id): Definition | undefined` and
`all(): Definition[]`. Catalog membership is fixed at construction; create a new
registry to change it. Input-array and returned-array changes do not alter the
catalog. Two registries may use the same ID with different definitions.

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

## Document editing session

`createDashboardDocument` from `./document` manages an existing document's
revision, draft and permissions without React or a shared cache. Create one
instance per mounted dashboard and authentication generation:

```ts
import { createDashboardDocument } from "@microboxlabs/miot-dashboard-ui/document";
import { DEFAULT_STORAGE } from "@microboxlabs/miot-dashboard-contract/document";

const document = createDashboardDocument({
  client,
  slug: "costs",
  sessionKey: "host-login-generation-1",
  emptyDocument: DEFAULT_STORAGE,
});
const unsubscribe = document.subscribe(() => render(document.getSnapshot()));
await document.load();
// On a permitted user edit:
document.onChange({ ...document.getSnapshot().config, name: "Updated costs" });
await document.save();
// When this dashboard/session is removed:
unsubscribe();
document.destroy();
```

`render` is your host's renderer. The required `sessionKey` is a non-secret host
generation identifier, never a token. Destroy and replace the instance on logout,
login, identity, server, tenant, scope or dashboard changes. There is no global
registry: separate instances never share drafts, documents or results. A host can
set `readOnly: true` to restrict editing further, but cannot grant permissions.

`getSnapshot()` returns a stable object until state changes: `config`, `etag`,
`capabilities`, `isLoaded`, `exists`, `dirty`, `busy`, `readOnly`, `error` (HTTP
status or null) and `editorKey`. Treat snapshots and nested documents as immutable.
`subscribe(listener)` returns an unsubscribe function, compatible with an external
store subscription. Initial state is read-only; editing requires a successfully
loaded existing document and server edit permission. Missing documents stay
read-only; create them explicitly through the HTTP client's zero-revision save.

| Method               | Behavior                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `load()`             | Loads document and capabilities together; refuses to discard a draft                         |
| `onChange(config)`   | Stages an edit when permitted; returns whether accepted                                      |
| `save()`             | Saves the draft with its original ETag; advances the revision on success                     |
| `discardAndReload()` | Explicit discard intent; replaces draft and editor history only after a successful reload    |
| `destroy()`          | Aborts outstanding work, drops local data/subscribers and permanently disables this instance |

Async methods return a boolean success result. Operations are serialized; edits
are disabled while a request is pending. Failures retain the draft, expose a
redacted status, and never trigger automatic writes. Authentication/authorization
errors also disable edits until a successful reload. Failed paired loads cancel
their sibling request. Teardown ignores late results even if a host transport
does not honor cancellation. Cancellation cannot undo a write the server already
committed; a new session must load the server revision.

The host owns navigation/discard prompts and authentication lifecycle. This
controller does not write browser storage or flush a teardown beacon.
