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

## Controlled React editing state

The optional `./react` entry exports `useDashboardState(controller, resolveWidget?)`.
It requires React 18.2 or 19 as a host peer. Other entries do not import React.
The hook manages widget trees, layouts, filters, planner definitions, dashboard
settings, JSON import/export and undo/redo. It performs no query or persistence
requests. The host supplies the current shared-contract document and accepts edits:

```tsx
import { useDashboardState } from "@microboxlabs/miot-dashboard-ui/react";
import type { DashboardStorageController } from "@microboxlabs/miot-dashboard-ui/react";

function DashboardName({
  controller,
}: Readonly<{ controller: DashboardStorageController }>) {
  const editor = useDashboardState(controller);
  return (
    <input
      aria-label="Dashboard name"
      value={editor.dashboardName}
      disabled={!controller.isLoaded || controller.readOnly}
      onChange={(event) => editor.setDashboardName(event.target.value)}
    />
  );
}
```

`controller` requires `config`, `isLoaded`, `readOnly`, and `onChange(config)`.
Edits require an explicitly loaded, writable controller. Permission enforcement
on the server remains authoritative. Feed accepted changes back as `config`;
treat documents as immutable. `editMode` is ephemeral and is stripped from
outgoing documents. A widget resolver returns `{ defaultConfig }` or `undefined`;
its defaults are applied recursively, with saved configuration taking precedence.
No widget catalog is imported automatically.

Mount a separate hook per dashboard. Remount the editor on identity, tenant,
scope, document or successful discard/reload changes, using the document
controller's `editorKey` when applicable, so undo history cannot cross sessions.
Undo history holds up to 50 snapshots and batches consecutive changes within 500 ms.
An edit after undo or redo always starts a new history branch. Unchanged grid
layout events do not create edits or clear redo history.
Imports must pass the shared version-2 schema before any state or history changes.
Unknown extension fields survive import/export. A successful import clears history. The hook does not
provide renderer components or authorize an imported document for server storage.

`useUndoRedo(getCurrentConfig, saveData, readOnly?)` is also exported for hosts
that need the same snapshot history with their own editing controls.

## Host filter and planner contexts

`useDashboardFilterState({ definitions, values, onChange })` manages active filter
values without reading location, browser storage or a shared cache. The host owns
`values` and feeds accepted changes back to the hook. `definitions` uses the
shared contract's filter definitions. The result exposes `activeFilters`,
`setFilter(key, value)`, `removeFilter(key)` and `clearFilters()`.

Empty values are omitted from `activeFilters`. Setting an empty value removes
that key. Clearing filters removes configured keys (including date-range suffixes)
and preserves unrelated host values. When no date-range definition exists,
`date_range_from` and `date_range_to` are included in the clear operation.
A unique filter replaces values belonging to its configured group.

`DashboardFiltersProvider` accepts this controller as its `controller` prop and
makes those actions available through `useDashboardFilters()`. Each host supplies
its own state. The Next.js app provides a URL adapter; external hosts can keep
filters in memory or synchronize them through their own routing system. Supply
only values intended for dashboard queries—this context does not discover URL
parameters or grant query permissions.

`PlannerResultsProvider` accepts a `value` with `results`, `definitions` and
`schemas`. `results` is a readonly map from planner variable names to
`{ rows, loading, error }`, where rows contain string-valued fields for existing
widget compatibility. `definitions` uses shared-contract planner definitions;
`schemas` maps variable names to column-name arrays. The host executes queries,
handles cancellation and redacts errors before passing results to this provider.
Treat result objects as immutable and pass an updated value when results change.

`usePlannerContext()` requires a provider. `useOptionalPlannerContext()` returns
an isolated empty fallback when none is mounted. Neither provider fetches data,
imports legacy executors or shares results between dashboards. Remount host
providers on identity or resource changes and cancel their outstanding requests.

## Saved-query results and refresh

`useSavedQueryResults(options)` executes saved server queries and returns a value
for `PlannerResultsProvider`. Required options are `client`, `sessionKey`, `slug`,
`queries`, `filters`, `refreshIntervalMs`, `paused`, and `errorMessage`.

- `client` implements `DashboardQueryClient`: `key(slug)` identifies the scoped
  resource, and `query(slug, queryId, filters, signal)` returns contract query rows.
  The package HTTP client implements this interface. Custom transports must enforce
  authentication, server authorization and response validation themselves.
- `sessionKey` is a non-secret authentication generation identifier. Change it on
  logout/login or identity changes, even when server and resource URLs stay the same.
- Only filters declared by each saved query are forwarded. Connection credentials,
  SQL execution and access checks remain on the dashboard server.
- At most four queries run concurrently per mounted hook, across request generations.
  A cancelled transport retains its slot until its promise settles; custom transports
  must honor cancellation to avoid delaying the replacement session. Duplicate query IDs or variable
  names produce the host's generic `errorMessage` without executing requests.
- Resource, session, client, query or declared-filter changes abort obsolete work.
  Old results are hidden immediately, and late responses are ignored. Unmounting
  aborts active requests and prevents queued work from starting.
- Rows normalize contract scalar/array values to strings for existing planner
  widgets. Null becomes an empty string; arrays become JSON. Schemas derive from
  returned columns, falling back to each query's declared schema for empty results.

A positive finite `refreshIntervalMs` enables polling. Polls retain displayed rows
while refreshing and skip ticks while requests are in flight. `paused` disables
periodic refresh; it does not disable initial loads or query/filter changes.
Hidden tabs pause polling and refresh when visible again. Failures expose only
`errorMessage`, which the host should translate and keep free of upstream details.

`usePollingInterval(callback, intervalMs)` is also exported. It invokes the latest
callback, pauses while hidden, and removes timers/listeners on cleanup. Zero,
negative, nonfinite and overflowing intervals (above 2,147,483,647 ms) disable polling.

## Isolated Handlebars templates

Import `createTemplateEngine` and `buildDataProviderContext` from
`@microboxlabs/miot-dashboard-ui/templates`. This entry needs neither React nor
Next.js. Each engine owns its helper registry without changing shared Handlebars.

```ts
const engine = createTemplateEngine();
const compiled = engine.compileTemplates([
  { id: "total", template: "{{multiply data_provider.count 2}}" },
]);
const context = buildDataProviderContext([{ key: "count", value: "3" }]);
const total = engine.resolveTemplate(compiled, "total", context, "Unavailable");
```

`compileTemplates` validates syntax eagerly, skips plain text and malformed
expressions, and returns a map reusable across data updates. `resolveTemplate`
returns the supplied fallback for missing templates or render errors.
`resolveField(template, context)` returns its original text on error.
Data-provider contexts preserve own keys safely, ignore empty keys, and use the
last value for duplicate keys.

Built-in helpers are `formatNumber`, `extractNumber`, `toFixed`, `round`,
`multiply`, `divide`, `formatDate`, `datePart`, and `timeAgo`. Trusted hosts may
supply additional helpers with `createTemplateEngine({ helpers })`; these are
local to that engine.

Inherited properties and methods are disabled during rendering. Ordinary
interpolations are HTML-escaped, but triple-brace expressions and helper-returned
safe strings can produce raw markup. Template output is not an HTML or URL
sanitizer: render text as text and validate URL/HTML destinations in the host.
Custom helpers execute trusted JavaScript and must never contain credentials or
perform privileged query execution in the browser.

## Recursive widget rendering

`WidgetRenderer` from `./react` renders a contract `widget` and its descendants
using a host-owned `registry.get(componentId)`. Definitions supply `Component`
and `meta.hasChildren` / `meta.hasSettings`. The component receives
`WidgetComponentProps`, including nested children and optional edit callbacks.
`unknownWidgetLabel` supplies localized text when a definition is unavailable.

Rendering is read-only by default. Editing requires both `editMode: true` and an
`onAction(widget, action)` handler. Derive edit mode from current server
capabilities; UI controls cannot grant authorization. Actions are `add`,
`settings`, `duplicate`, and `delete`; add/settings are additionally gated by
widget metadata. View-mode components receive no mutation callbacks.

A host may provide a stable `Frame` component receiving `WidgetFrameProps` to
render controls around each widget. Its `onAction` is gated by the same rules.
The host owns dialogs and applies confirmed edits through its document controller.
The renderer does not fetch data, persist changes, or open global portals.

Each mounted root generates its own widget ID namespace. `widgetDomId(widget)`
is an optional compatibility override for host anchor links; its returned IDs
must be unique across all mounted dashboards. `isRoot` is passed only to the
initial widget; descendants receive `false`.
