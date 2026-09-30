# @microboxlabs/miot-dashboard-ui

Reusable dashboard rendering, layout, document state and server transport, using
`@microboxlabs/miot-dashboard-contract`. React hosts use `./react`; other web
frameworks can use `./embed`, `./web-component` or the self-contained `./browser`
runtime. `./core`, `./client`, `./document` and `./templates` expose the lower-level
APIs. Import `./styles.css` for the scoped presentation styles.

This workspace version is **unreleased**. The portable catalog includes text,
percentage, circular and progress statistic registries; it is not yet the complete app
widget catalog or a complete dashboard authoring interface. Query execution and
authorization remain on the dashboard server.

For a runnable browser host with a private server proxy and real saved-query
binding, see the [standalone billing example](../../examples/dashboard-ui-standalone/README.md)
([Español](../../examples/dashboard-ui-standalone/README.es.md)).

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

### Template data helpers

The `./templates` entry also exports pure helpers for data already supplied by a
host or an authorized saved query. They do not perform network requests.

- `parseTemplateRow(json)` accepts a JSON object or the first object in a JSON
  array. Empty, malformed, scalar and nested-array values return `undefined`;
  dashboard contents are never logged. JSON value types are preserved.
- `createTemplateContext({ row, filters, dataProvider? })` exposes row fields at
  the top level and the original object under `row`, plus explicit `filter` and
  optional `data_provider` namespaces. Explicit namespaces override colliding row
  fields. Inputs are not mutated.
- `resolveTemplateFields(fields, context, engine)` resolves named text fields
  using the supplied isolated engine. Prototype-named output fields remain
  ordinary own properties.

## Recursive widget rendering

`WidgetRenderer` from `./react` renders a contract `widget` and its descendants
using a host-owned `registry.get(componentId)`. Definitions supply `Component`
and `meta.hasChildren` / `meta.hasSettings`. The component receives
`WidgetComponentProps`, including nested children and optional edit callbacks.
`unknownWidgetLabel` supplies localized text when a definition is unavailable.

Rendering is read-only by default. Editing requires both `editMode: true` and an
`onAction(widget, action, componentId?)` handler. Derive edit mode from current server
capabilities; UI controls cannot grant authorization. Actions are `add`,
`settings`, `duplicate`, and `delete`; add/settings are additionally gated by
widget metadata. A widget calling `onAddChild(componentId)` forwards that requested
child type to the host as the optional third argument; the host remains responsible
for validating allowed nesting. View-mode components receive no mutation callbacks.

A host may provide a stable `Frame` component receiving `WidgetFrameProps` to
render controls around each widget. Its `onAction` is gated by the same rules.
The host owns dialogs and applies confirmed edits through its document controller.
The renderer does not fetch data, persist changes, or open global portals.

Each mounted root generates its own widget ID namespace. `widgetDomId(widget)`
is an optional compatibility override for host anchor links; its returned IDs
must be unique across all mounted dashboards. `isRoot` is passed only to the
initial widget; descendants receive `false`.

## Text card and scoped styles

`TextCard` from `./react` displays already-resolved text. Its props are `text`,
`italic` (default `true`), and `align` (`left`, `center`, or `right`, default
`left`). It does not compile templates, fetch data, or interpret text as HTML.

Import `@microboxlabs/miot-dashboard-ui/styles.css` once in the host application.
The published stylesheet is precompiled and scoped to `miot-*` classes; hosts do
not need Tailwind source scanning. It is marked as a CSS side effect so bundlers
retain an explicit stylesheet import. JavaScript modules remain tree-shakeable.

A parent with `data-miot-theme="dark"` enables the dark card palette. Existing
`.dark` ancestors are also supported. Hosts can override `--miot-card-background`,
`--miot-card-border`, and `--miot-card-text` on a containing element. Typography
inherits the host font, and the card fills the host-provided height.

## Dashboard grid

`DashboardGrid` from `./react` lays out root contract widgets using their stored
coordinates and a host registry's `getLayoutDefaults(config)`. Import
`@microboxlabs/miot-dashboard-ui/styles.css` once. `renderWidget(widget)` supplies
the content, typically a `WidgetRenderer` or a host adapter around it.

The grid measures its own container and scales the layout. Narrow-view clamping
is display-only: mounting or resizing the viewport never calls `onLayoutCommit`.
Editing requires both `editMode: true` (derived from current server capabilities)
and `onLayoutCommit(layout)`. The callback runs after a completed drag or resize
and preserves the document's min/max constraints. The host applies those edits
through its controlled document state and revision-aware persistence.

The grid owns no page keyboard shortcuts, navigation, authentication, or save
requests. Hosts supply those controls and accessible alternatives to pointer
layout editing. React and ReactDOM peers must use matching supported versions.

## Dashboard canvas

`DashboardCanvas` from `./react` combines the responsive grid and recursive widget
renderer. Supply contract `widgets`, a registry with `Component`, `meta`, and
`getLayoutDefaults(config)`, and a localized `unknownWidgetLabel`. Import the
package stylesheet once; the canvas requires no Tailwind configuration.

The canvas is read-only by default. Hosts may supply `editMode`, `onAction`,
`onLayoutCommit`, and an optional `Frame` for editing controls. Each operation
still requires its corresponding callback. Derive edit intent from server
capabilities and apply edits through the document controller; this component
performs no network or persistence operations. Widget IDs are namespaced per
mounted renderer, including when multiple canvases contain the same document.

This API composes registered widgets; it does not automatically register app
plugins or provide settings dialogs, a catalog picker, or authentication.

## Native mount lifecycle

`mountDashboard(element, options)` from `./embed` renders a canvas in an empty
host-owned element and returns `update(options)` and `destroy()`. Import the
package stylesheet once. Options contain the canvas props plus a required,
nonempty `instanceKey`: change this key whenever the tenant, authenticated
session, or document changes. The key resets widget-local state; it is not an
authorization credential and must not contain tokens or secrets.

Updates replace all options, including callbacks and edit intent. Same-key
updates retain component state. `destroy()` is idempotent, releases the container,
and must run before the host removes it. Updating a destroyed handle, mounting
twice in the same element, mounting over existing host content, or omitting an
instance key throws `DashboardMountError` with a stable `code`.

For LiveView, use a hook with an ignored mount container; call `update` from the
hook's update lifecycle and `destroy` from its destruction lifecycle. The host
supplies the registry and data. This ESM entry uses React/ReactDOM peers internally
but requires no host React root management; it is not yet a standalone browser
script distribution or an automatically configured widget catalog.

## Web Component

Call `defineDashboardElement()` from `./web-component` in the browser to register
`<miot-dashboard>` explicitly. An optional tag name supports host naming
conventions. Repeating registration with this module is safe; a name owned by
another implementation throws `DashboardElementRegistrationError`.

Set `element.dashboardOptions` to the same options used by `mountDashboard`.
Configuration is a JavaScript property, never JSON or credentials in HTML
attributes. Properties assigned before element registration are upgraded.
Updates replace all options; setting `undefined` clears the mounted dashboard.
Removing the element destroys its root; reconnecting mounts fresh local state
using the last options. The host must update `instanceKey` across identity changes.

Use an empty element and import the package stylesheet. Rendering uses light DOM
and scoped styles; host CSS can still affect inherited typography. Importing the
entry does not access the DOM or register an element, but registration requires
the browser's `HTMLElement` and `customElements`. The registry remains host supplied, with no automatic authentication. Optional
`savedQueries` connects descendant widgets to saved server-query results.

## Flex container

`FlexContainer` from `./react` renders nested content in a row, column, or wrapping
`grid` layout. Import `./styles.css`; no Tailwind build is required. Supply `title`
and the localized `emptyLabel`. `editMode` hides the empty message so a host can
show its insertion controls. Key child elements by widget ID to preserve their
state when reordered. `description` accepts plain text or trusted host-rendered
React content (for example, a Markdown renderer); the component never interprets
strings as HTML. Card colors use the same `--miot-card-*` variables and
`data-miot-theme="dark"` ancestor convention as `TextCard`.

## Self-contained browser distribution

The `./browser` export (file `dist/browser/browser.js`) bundles the rendering
runtime for non-React hosts. Copy that file and `styles.css` from the same package
version into your application's static assets. Import `mountDashboard` or
`defineDashboardElement` directly from the copied ESM file; no import map,
React installation, or JavaScript bundler is required in the host.

Use `./react`, `./embed`, or `./web-component` when your application already
manages React peers. The browser distribution owns its runtime; custom widget
plugins using React hooks must not mix it with a separate React installation.
The host still supplies a compatible registry, authorized data and instance key.
It does not turn the dashboard server into a UI asset server or register a widget
catalog automatically. Serve version-matched assets using your host's cache policy.

## React document lifecycle

`useDashboardDocument(options)` from `./react` connects React hosts to the same
revision-aware controller as `createDashboardDocument`. Supply `client`, `slug`,
`sessionKey`, and `emptyDocument`. Keep client and empty-document references stable
between renders (for example with `useMemo`); replace `sessionKey` on login/logout
or identity changes. Tokens and authentication implementation remain in the host.

The hook exposes document state, `etag`, `onChange`, `save`, and
`discardAndReload`. It starts read-only, waits for server capabilities, preserves
drafts on conflicts and failed reloads, and aborts outstanding work on unmount.
A changed client/resource/session hides old state before effect cleanup. Optional
`readOnly: true` removes editing access; it cannot grant server permissions.
Changing this restriction or `emptyDocument` starts a fresh controller and discards
its previous local draft, just like changing identity; keep these stable while
editing and obtain discard intent in the host when appropriate. No browser storage,
router, login, global cache, or automatic save is installed.

## Percentage value

`PercentageValue` from `./react` displays a resolved `title`, numeric `value` and
`max`, and optional hexadecimal `barColor` without `#`. Import `./styles.css`.
It fills the supplied height, shows the count and rounded percentage, and exposes
a native progress element named by the title. Displayed progress is clamped to
0–100; nonfinite values fall back to zero and a nonfinite maximum to ten, matching
the existing dashboard widget. A zero or negative maximum shows zero progress.

This component does not execute queries or evaluate color rules. Resolve those in
the data adapter before rendering. Invalid colors use the default blue; strings
are rendered as text. Scoped dark-theme and card color overrides apply, with
`--miot-progress-track` available for the progress track.

## Saved-query provider

`SavedQueryProvider` from `./react` executes configured saved dashboard queries
through the supplied client and exposes their results to descendant widgets.
Pass the same options as `useSavedQueryResults`, including the authenticated
`sessionKey`, dashboard `slug`, filters, refresh interval, pause state and localized
`errorMessage`. Change the session key when identity changes; queries execute on
the dashboard server, where permissions and connection credentials are enforced.

`usePlannerData(variableName)` reads one named result from the nearest provider
without issuing a request. It also works with `PlannerResultsProvider` for hosts
supplying existing planner results. Outside a provider, or for an absent name,
it returns a stable empty result scoped to that hook instance. Sibling providers
remain independent even when they use identical query names. Query rows retain
the planner-compatible representation documented above.

## Circular statistic

`CircularStat` from `./react` renders a circular progress card. Import `./styles.css`
and provide `title`, numeric `value` and `max`, host-formatted `valueLabel`, `unit`,
and a complete localized `totalLabel` (for example, `of 100 GB`). Optional
`ringColor` accepts hexadecimal RGB/RGBA without `#`; invalid colors use blue.
The renderer clamps progress to 0–100 and treats nonfinite numeric inputs as zero,
while preserving display labels as literal text. The named progressbar exposes
both the normalized percentage and supplied labels to assistive technology.
The fixed 100px ring retains existing widget geometry; use a sufficiently tall
host cell. Motion respects `prefers-reduced-motion`. Card and track colors support
the existing theme variables and dark ancestor convention. Data fetching,
Handlebars evaluation and threshold rules remain in the caller.

## Saved queries in native mounts

`mountDashboard` and `element.dashboardOptions` accept optional `savedQueries`:
all `SavedQueryOptions` except `sessionKey`, which follows the mount's
`instanceKey`. Supply the saved query client, dashboard slug, query definitions,
filters, refresh interval, pause state and localized error message. Queries run
through the server transport; no connection credentials belong in these options.
Change `instanceKey` when the authenticated identity or document changes.

Custom React widgets can read results using public `usePlannerData`; the peer
embedding entries share the public React provider context. Removing `savedQueries`
on update aborts its requests and clears results while preserving widget-local state. Destroying the mount or
changing identity also aborts outstanding work. Updating options still replaces
all values. Hosts manage filter controls and capability-derived edit intent.
The standalone browser bundle keeps its own runtime; do not combine widgets from
a second React installation with it. A built-in data-bound catalog is not yet
registered automatically.

## Built-in text-card registry

`createTextCardRegistry(options)` from `./react` supplies the `text_card` renderer
and layout metadata for `DashboardCanvas` or `WidgetRenderer`. Create the registry
once per dashboard instance. Provide localized `defaultText`, `loadingLabel`,
`errorLabel` and `unsupportedDataLabel`. Compose additional definitions through
`createWidgetRegistry([...textRegistry.all(), ...otherDefinitions])` from `./core`.
This is the first built-in entry, not the complete widget/settings catalog.

Static cards accept `text`, `italic`, `align`, `staticData` JSON and `dataProvider`
entries. `dataMode: "planner"` with `plannerVariableName` reads the nearest
`SavedQueryProvider` or `PlannerResultsProvider`; it issues no request itself.
Missing query bindings and query failures show `errorLabel` without transport
details. Legacy direct-query modes show `unsupportedDataLabel`; migrate them to
server saved queries before using this renderer. No old query endpoint is called.

Handlebars templates receive the first data row, reserved `row`, `filter` and
`data_provider` namespaces using the shared template helpers. Each registry owns
an isolated template engine by default; optional `templateEngine` accepts a
host-owned engine for custom helpers. Its compiled templates are scoped to each
widget and refreshed when text changes. Output is always rendered as text.
The template compiler retains the CSP requirements of `./templates`; this API
does not claim precompiled-template support. Settings are not advertised yet.

The `./embed` and self-contained `./browser` entries also export
`createTextCardRegistry`. Import it from the same runtime as `mountDashboard`,
then pass the registry and optional `savedQueries` to the mount. Plain HTML hosts
can render supported text-card configurations without implementing a React widget
or installing React. This explicitly registered first entry includes the
Handlebars compiler and its CSP requirements; it does not automatically migrate
legacy direct-query configurations or provide other widget types/settings.

Native mount options can include `filterController` with `definitions`, `values`
and `onChange`. Its values drive both template `filter` namespaces and saved-query
parameters. Hosts apply requested changes by calling `update` with new controlled
values. Without a controller, `savedQueries.filters` supplies read-only filter
values to widgets and queries; widget filter changes are ignored. Removing a
controller restores those fallback values. Provider boundaries remain stable
across updates, preserving widget-local state for the same `instanceKey`.

### Text appearance fields

`TextCardFields` from `/react` provides controlled text, alignment and italic
controls. Import `@microboxlabs/miot-dashboard-ui/styles.css` for their styling.
Pass `value`, `onChange` and localized `labels` (`legend`, `text`, `placeholder`,
`alignment`, `left`, `center`, `right`, `italic`). The callback returns the whole
appearance value; the host owns the draft and Apply/Cancel actions.

`disabled` disables the field group and change callbacks. Optional `textStatus`
(`none`, `valid`, `invalid`) and `validationMessage` expose host validation through
visual and accessible feedback. Each instance generates its own label IDs. These
fields do not execute templates, fetch data or persist configuration.

## Color-rule comparisons

The React-free `./core` entry exports `evaluateRule`, `findMatchingColor`,
`ColorRule` and `ColorRuleOperator`. They preserve existing dashboard comparison
semantics: trimmed case-insensitive string matching, numeric comparisons of
formatted cell values, and first-match rule order. `findMatchingColor` accepts
a host resolver with the row, row index and total count; it returns a color token
or `null`. These functions do not produce CSS, validate color tokens, execute
templates or fetch data. Renderers remain responsible for safe color styling.

`sortColorRules` orders numeric thresholds using existing dashboard precedence
without mutating the input. Thresholds are sorted within their existing slots;
non-threshold rules retain their positions. `evaluateColorRulesGeneric` chooses the first matched
color independently for each requested target. Field-based counterparts
`sortColorRulesWithFields` and `evaluateColorRulesWithFields` resolve comparison
values from supplied fields (`previousValue` by default; missing fields use zero).
Hosts supply target names and field values; these helpers own no rendering state.

## Built-in percentage registry

`createPercentageValueRegistry` is available through `./react`, `./embed` and
`./browser`. Supply localized `defaultTitle`, `loadingLabel`, `errorLabel` and
`unsupportedDataLabel`, plus an optional isolated `templateEngine`. Compose its
`percentage_value` definition with other registry definitions. Settings remain
host-owned.

The registry resolves `title`, `value` and `max` from static data or the nearest
saved/planner query result, sharing filters and template namespaces with text
cards. Unknown/legacy direct-query modes require migration. Pending queries show
loading; failures clear values and display the supplied error label.

Existing `barColorRules` support count or percentage evaluation with threshold
ordering; nonempty valid rules remain active for legacy compatibility. Invalid
operators are ignored. Displayed progress is clamped, and the renderer validates
hex colors. Default value/max are 6/10; unresolved numeric values fall back to
0/10. Browser hosts import this factory from the same runtime as their mount.

## Built-in circular statistic registry

`createCircularStatRegistry` from `./react`, `./embed` or `./browser` supplies
`stat_circular` with static or saved/planner-query bindings. Pass localized
`defaultTitle`, `defaultUnit`, loading/error/unsupported labels and
`formatTotal(max, unit)` returning a complete localized footer. The optional
`templateEngine` supports isolated custom helpers.

The widget resolves title, value, maxValue and unit, including data-provider and
filter namespaces. It accepts old numeric configuration values, preserves the
resolved value label, and clamps the accessible progress. Ring rules retain the
circular widget's historical mixed-operator ordering; same-direction numeric
thresholds prefer the strongest match. Only hex ring colors reach styling.
The registry does not provide settings or execute legacy direct queries.

## Progress statistic

`ProgressStat` from `./react` displays resolved `title`, `value`, `target` and
`unit` with quarter milestones and accessible native progress. Optional
`barColor` and `textColor` accept RGB/RGBA hex without `#`; invalid colors are
ignored. Nonfinite values and out-of-range percentages are normalized for display.

`createProgressStatRegistry({ defaultTitle, defaultUnit, loadingLabel,
errorLabel, unsupportedDataLabel, templateEngine? })` is available from
`./react`, `./embed` and `./browser`. It registers `stat_progress`, resolves
static/template/provider/saved-query fields, and preserves numeric configs.
Defaults are value 78 and target 100; hosts provide localized title/unit labels.

Bar rules evaluate the resolved value in saved order, with the first valid match
winning. An enabled threshold evaluates its configured template field, applying
to `background` and/or `text` (`text` by default). Thresholds accept legacy named
colors or hexadecimal colors. Bar rules take precedence over thresholds; otherwise
progress uses red, yellow, blue and green at the 0/25/50/75 percent boundaries.
Legacy direct `pgrest` bindings display migration feedback without executing a query.
The registry does not supply settings or issue credentials; the host supplies
saved-query results and controls authoring permissions.

The progress statistic registry and `ProgressStat` accept optional
`formatValue(value, target, unit)` for localized accessible progress text. The
formatter receives resolved finite values; without it the display uses
`value / target unit`. The Next.js adapter supplies its translated “of” label.

## Table and list row controls

`useFilterAndSort(filter, sort, rows, columns)` from `./react` owns instance-local
selection and sort state for already authorized string-valued rows. It returns
`displayRows`, `filterOptionsByColumn`, `validSortColumns`, `filterValues`,
`sortKey`, `sortDir`, `getColumnLabel`, `handleFilterSelect`, `handleFilterClear`
and `handleSortClick`.

- `filter`: `{ enabled, items: [{ column, label }] }`; selections combine with AND.
- `sort`: `{ enabled, columns: string[] }`; clicks cycle ascending, descending,
  then original order. Empty values sort last in both directions. A column
  removed from the declared catalog stops affecting the result.
- `columns`: `{ key, label }[]`; filters accept plain property keys or single
  templates such as `{{row.service}}`. Compound templates are not evaluated.
- `rows`: `Record<string, string>[]`; input order and row objects are not mutated.

`resolveDataProperty(key)` from `./core` exposes the same simple-property parser.
The hook does not fetch data, execute templates or render a table. Server-side
permissions remain authoritative; a host must remount instance-local controls
when switching identities or documents, as it does for other local UI state.

`FilterPillRow` and `SortPillRow` from `./react` render controlled row toolbars.
Import `./styles.css`; no host Tailwind setup or icon package is required.

- `FilterPillRow({ item, options, selected, allLabel, onClear, onSelect, disabled? })`
  uses `{ column, label }` for `item`. Callbacks receive the column and, for
  selection, its value. An empty selection means all rows; empty options are
  omitted and duplicates are collapsed.
- `SortPillRow({ label, columns, sortKey, sortDir, directionLabels,
  getColumnLabel, onSortClick, disabled? })` accepts `directionLabels: { asc, desc }`
  in the host language. The active button exposes its direction and pressed state.
  Empty column lists render no group.

Both controls use unique group labels, native buttons, focus-visible styling and
literal text. Disabled controls prevent user interaction; authorization must
still be enforced by the server. Wire their callbacks to `useFilterAndSort` or
an equivalent host-owned controller.

## Table cell content

`TableCellValue({ value, type?, colorMap?, progressLabel? })` from `./react`
provides literal text, multiline text, badge, signed-number and progress content.
`value` is a resolved string; this component never compiles templates, HTML or URLs.
Unknown types and the legacy `highlight` type use text rendering. Load `./styles.css`.

`colorMap` accepts `{ operator, value, color }[]` using the shared rule operators.
The first valid matching color wins; colors accept six-digit hex without `#` or
`red`, `yellow`, `green`, `blue`, `gray`, `orange`, `purple`. Invalid colors cannot
suppress a later valid match. Named badges retain light/dark palettes; custom hex
badges use transparent backgrounds and borders.

Progress cells expose native accessible progress with an optional localized
`progressLabel` (otherwise the displayed value), clamped to 0–100. Negative
percentages clamp to zero instead of losing their sign. Signed values preserve
the existing negative/below-1000/1000-or-more tones. Input rows are never modified.
`renderCell(value, type, colorMap?)` provides a compatibility function for existing
React table/list cell slots. These are cell primitives, not a complete table grid.

## Table column templates

`useCompiledColumns(columns, rowCount, options?)` from `./react` compiles column
keys, labels and types once per column definition/engine change. Columns contain
`{ key, label, type }` strings. It returns:

- `resolveValue(key, row, rowIndex, totalRows)` with row fields, `row`, `_index`
  and `_count` available to templates. Plain keys read only the row's own properties.
- `resolveLabel(key)` with `_count` available for headings.
- `resolveType(key, row, rowIndex, totalRows)` with the same row context, falling
  back to `text` for missing/empty types.

Each hook instance owns an isolated template engine unless the host supplies
`{ templateEngine }`. Custom helpers must be registered on that engine; changing
it recompiles the columns. Invalid syntax/helper failures use the existing
column/row fallbacks. Render results as text through the cell primitives, never
as raw HTML. The current compiler has the same `unsafe-eval` CSP constraint as
other template APIs. Query execution remains outside this hook.

## Typed column filters

`useColumnFilters(rows, columns)` from `./react` provides instance-local typed
filters over authorized string-valued rows. Columns contain `{ key, dataType? }`;
`dataType` is `text`, `number`, `date`, `enum` or `boolean`. Without an explicit
type, the hook detects boolean/date/numeric or low-cardinality enum values.

The result exposes `filters`, `filteredData`, `enumValues`, `resolvedDataTypes`,
`setFilter(key, filterOrNull)`, `removeFilter(key)`, `clearAllFilters()`,
`activeFilterCount`, `totalCount` and `filteredCount`. Filters combine with AND.
Removing a column stops its retained filter from affecting visible results or
controls. Every call normalizes the filter's `columnKey` to the supplied key.

`ColumnFilter`, `FilterOperator`, `ColumnDataType`, `FilterableColumn` and
`getDefaultOperator(dataType)` are exported from `./core`. Operators cover text
contains/equality, numeric equality/comparison/range, date range, enum membership,
boolean equality, and empty/nonempty values. Numeric parsing retains the app's
currency/unit and decimal-comma conventions. Date ranges retain the app's native
JavaScript date parsing; hosts must validate their intended timezone behavior.

Rows are not mutated. Inherited object properties are never row values, and
prototype-shaped keys remain ordinary data. This hook filters results already
returned by the server; it does not authorize rows or issue database queries.

Filter evaluation rejects incompatible operator/value combinations and unknown
boolean strings. Numeric detection and matching share validated parsing: comma
thousands groups require groups of three; a single comma with a different
fraction length is decimal. Repeated decimal separators are not numeric. The
returned active-filter record has no object prototype, so inactive names such
as `constructor` and `toString` read as undefined.

### Active column filter summary

`ColumnFilterToolbar` from `./react` renders controlled filter chips and a
clear-all button. Import `./styles.css`. Pass `filters` from `useColumnFilters`,
`columns` (keys and optional labels), `onRemove`, and `onClearAll`. Hosts supply
`summary`, `clearAllLabel`, `removeLabel(text)`, and `formatValue(filter)` to keep
all visible and accessible text localized. Values render as literal text.
Optional `disabled` disables both removal actions; an empty filter record renders
nothing. The component does not fetch data or enforce server permissions.

### Typed column filter inputs

`ColumnFilterInput` from `./react` supplies text, number, date, enum and boolean
editors without app context or Flowbite. Pass `columnKey`, `dataType`,
`currentFilter`, `enumValues`, `onFilterChange(key, filterOrNull)` and a `labels`
object for search, operators, bounds, dates, empty states and boolean choices.
Import `./styles.css`. Text and number changes emit after 300 ms; unmounting or
changing the column cancels pending emissions. An optional `cancelDebounceRef`
lets a host cancel pending input before a separate clear action. Text columns
with enumerated values use checkbox selection unless an existing text filter is
present. Date fields use native date inputs; numeric ranges allow open bounds.

The host owns popover positioning and focus management. Inputs synchronize draft
text, numeric and date values when `currentFilter` changes, cancelling pending
emissions. Enum and boolean selections follow `currentFilter`. Radio names and
date label IDs are unique across instances.

### Anchored column filter popover

`ColumnFilterPopover` from `./react` wraps `ColumnFilterInput` with a native
nonmodal dialog and an accessible filter trigger. It accepts the same filter
and labels props, plus `title`, `clearLabel`, optional `theme` (`light`/`dark`)
and `portalContainer` (defaults to the trigger document's body). Import
`./styles.css`. It inherits the closest host theme when no explicit theme is set.

Opening focuses the first input; Escape and clearing restore trigger focus.
Outside pointer interaction or moving keyboard focus outside closes the editor
without stealing focus. Closing cancels pending debounced changes. The panel
repositions on resize/scroll and bounds itself to the viewport. The portal
container lets hosts retain their chosen DOM styling boundary.

### Table and list actions

The `./core` entry exports `ActionItem`, `ActionsConfig`, `RowAction`, target and
method constants, `normalizeActionsConfig`, `normalizeRowActions`, and editor ID
round-trip helpers (`toActionItems`/`fromActionItems`,
`toRowActionItems`/`fromRowActionItems`). Normalizers accept own action fields,
`_self`/`_blank` targets and the `goto` row method. Malformed config containers use
the caller's trusted fallback; malformed table entries are omitted independently.
Structurally valid draft links (including empty or unsafe text) stay editable.
Row positions are preserved: malformed rows become empty, non-navigable drafts,
so a secondary action never replaces the primary left-click slot. Normalization
does not authorize navigation; renderers must validate resolved links.

`isSafeActionUrl(link)` allows HTTP(S), mailto, tel and relative links. It rejects
empty and other protocol destinations, including executable schemes obfuscated
with browser-stripped ASCII whitespace. Validate the resolved Handlebars result
again immediately before displaying a link or navigating. This function checks
protocol safety, not destination authorization or hostname syntax. Hosts can
apply stricter origin policy and must use `noopener noreferrer` for new tabs.
The helpers do not navigate, open windows or call a server.

### Resolved action dropdown

`ActionDropdown` from `./react` accepts `items: { action: ActionItem, href: string }[]`,
`ariaLabel` and optional `theme`. Import `./styles.css`. The host resolves links;
the component rechecks their protocols and targets before rendering. Unsafe
items are omitted and an empty list has no trigger. New-tab links use
`noopener noreferrer`; labels render literally.

The portal inherits the nearest host light/dark theme unless overridden. Opening
focuses the first link, Escape restores trigger focus, and outside focus/pointer
or scroll/resize dismisses the panel. Native links retain normal browser keyboard
navigation; this is a nonmodal dialog, not an ARIA menu with custom arrow-key
navigation. Trigger/link clicks do not invoke an enclosing row click handler.

### Presentational data table

`DataTable` from `./react` renders authorized string-valued `rows` and structural
`columns` (`key`, `label`, `type`, optional `sticky`, cell color rules and
`decorator`). Supply `label`, `emptyLabel`, `loadingLabel`, `actionsLabel` and
`resolveValue(key, row, index, count)`. Optional `resolveLabel` and `resolveType`
connect the shared column template engine. Import `./styles.css`.

`loading` and `errorLabel` hide result rows. `showColumnDividers` defaults to true.
Contiguous sticky groups at either edge remain pinned; left takes precedence if
all columns are sticky. Header resizing/content changes recompute offsets. An
optional action column remains pinned at the right edge.

Hosts can compose `renderHeader(column, label)` with filter popovers/descriptions,
`renderActions(row, index)` with the safe action dropdown, and `rowColor(row,
index)` with the legacy named row colors. Callbacks return host UI; the table
never executes SQL, resolves authentication, or renders raw HTML. The Next.js
`data_table` widget now uses this renderer. The resizable `data_table_v2` and its
row gestures remain separate migration work; this entry is not a standalone
saved-query widget registry.

### Data table registry

`createDataTableRegistry(options)` is available from `./react`, `./embed` and
`./browser`. It registers `data_table` using static `rows` or a named
`plannerVariableName` supplied by the nearest saved-query/planner provider.
It composes column Handlebars templates, safe actions, typed column filters,
filter/sort pills, named row colors and the sticky table renderer. Invalid
configuration, query failures and legacy direct datasource modes display host
feedback; loading/errors never display old result rows.

Options provide `defaultTitle`, `loadingLabel`, `errorLabel`,
`unsupportedDataLabel`, `emptyLabel`, `actionsLabel`, `allLabel`, `sortLabel`,
`clearFilterLabel`, `clearAllLabel`, `directionLabels`, `filterLabels`,
`filterTitle(column)`, `filterSummary(filtered,total)`, `removeFilterLabel(text)`,
`formatFilterValue(filter)` and `rowCountLabel(count)`. Optional `exportLabel` enables CSV export when
`config.showExport` is true (the default); `onExportCsv(content, filename)`
overrides the browser download for another host. Optional `templateEngine`
allows host helpers. Titles can use `_count`; columns receive row/index/count
context. Column descriptions are literal native tooltips in this registry.

This candidate is a viewer: it does not supply settings,
resizable `data_table_v2`, or authorization. Hosts provide saved-query transport
and remount on identity/document changes. Next.js currently consumes the table
renderer with its own adapters; adopting this complete registry there remains
separate work.

### CSV export

`buildCsvContent(columns, rows, resolveValue, resolveLabel)` from `./core` builds
semicolon-separated CSV from supplied rows in order, using the same template
resolvers as the table. It quotes delimiters, quotes and line breaks. Formula-like
cells and headers beginning with `=`, `+`, `-` or `@` (after leading whitespace),
and cells beginning with tab/CR/LF, receive a leading apostrophe; plain signed
decimal numbers remain numeric. Consumers should preserve this protection when
processing the output. Empty rows return an empty string.

`downloadCsv(content, filename)` from `./react` is browser-only and should be
called after a user export action. It adds a UTF-8 BOM, replaces control/path
characters in the filename and releases its object URL after the browser starts
the download. Pure hosts can use the builder and handle delivery themselves.
The table registry exports only its currently filtered/sorted result rows; it
does not fetch additional data or bypass server permissions.

### Resizable table widths

`useTableColumnWidths(options)` from `./react` shares the existing resizable
Next.js table's width measurement, drag and auto-fit behavior. Hosts supply
`columns`, `tableRef`, `headerRowRef`, `hasActions`, `measureStickyOffsets`, and
optionally `savedWidths`, `loading`, `error`, `editable`, and `onCommit(widths)`.
It returns `columnWidths`, `thRefs`, `colRefs`, `handleResizeMouseDown(event,
index)` `handleResizePointerDown(event, index)`, `resizeColumnBy(index, delta)` and
`autoFitColumn(index)` for the host renderer.

Widths persist by column key only after a completed interaction when `editable`
is true. Viewers may resize locally; the last data column fills the remaining
space and is excluded from persisted widths. Saved changes (including undo)
remeasure the layout; nonfinite saved widths are ignored. An interrupted drag,
unmount or window blur removes listeners and restores prior cursor/selection
styles. Hosts can disable measurement with `enabled: false`. Pointer handlers
also support cancellation and filter other pointers during an active drag.

### Row context navigation

`RowContextMenu` from `./react` renders resolved `ResolvedContextItem[]` links
(`{ action: RowAction, href: string }`). Required props are `items`, viewport
coordinates `x`/`y`, translated `ariaLabel`, and `onClose`. Optional `theme`,
`portalContainer` and `returnFocusTo` support embedded hosts. Import the package
stylesheet. The Next.js resizable table uses this component.

The nonmodal dialog uses native link keyboard navigation, focuses its first
link, restores the supplied element (or previous focus) on Escape, and closes
on outside interaction, outside scrolling or window resize. It clamps its
position within the viewport. Only `goto` actions with safe resolved URLs and
`_self`/`_blank` targets are shown; blank targets use `noopener noreferrer`.
Names remain literal text. Hosts still authorize destinations and provide an
accessible trigger; this component does not evaluate templates or query data.

### Resizing the shared table renderer

`DataTable` accepts optional `resizing: TableResizingOptions`: `savedWidths`,
`editable`, `onCommit`, and required `handleLabel(columnLabel)`. Translate the
label and describe the controls: drag to resize, Left/Right to adjust by 10px
(Shift for 50px), Enter/Space or double-click to auto-fit. The last data column
fills available space and has no handle. Resize buttons use pointer events
and disable native touch panning only on the handle. Without `resizing`, the
table retains its original automatic layout.

Changes remain local unless `editable` and `onCommit` are supplied. The host
owns persistence and authorization; the callback alone does not grant edit
permission. Both Next.js table variants consume the shared renderer; the resizable
variant keeps its host query, descriptions, translations and settings adapter.

### Table row navigation

`DataTable.rowActions(row, index)` optionally returns resolved context actions.
The first configured action is primary: its safe URL appears as a native link
in the first cell and can also be activated by clicking noninteractive row
content. Text selection and controls within the row do not trigger navigation.
Unsafe primary links are omitted rather than replaced by a secondary action.
The remaining safe links are available through the row context dialog and a
keyboard-accessible action dropdown. Host `renderActions` can coexist with them.
The host resolves templates and authorizes destinations; the renderer rechecks
URLs and targets. `striped` enables alternating row backgrounds where no row
color rule applies.

### Resizable table widget registry

`createResizableDataTableRegistry(options)` from `./react`, `./embed` and the
self-contained browser runtime registers `data_table_v2`. It accepts the same
translations, templates, export callback and saved-query bindings as
`createDataTableRegistry`, plus required `resizeLabel(columnLabel)` instructions.
Register either or both variants when composing a dashboard registry.

The resizable variant reads saved `columnWidths`, `striped` and `rowActions`,
honors configured sortable columns in both headers and the toolbar, and provides local viewer resizing.
Widths must be finite and positive. Row links use per-row template context and
are rechecked after resolution. These registries do not persist viewer changes
or provide widget settings; an editing host can use `DataTable` callbacks and
its authenticated document controller. Column descriptions remain literal
hover text in the registry; the Next.js host retains its Markdown tooltip.

### Data-list cards

`DataListCard` from `./react` renders one authorized row using `DataListCardLayout`
(`titleColumn`, `subtitleColumn`, `headerBadgeColumns`, `kpiColumns`, and
`footerColumns`). Pass `row`, `rowIdx`, `totalRows`, `columns`, and the
`resolveValue`, `resolveLabel`, `resolveType` callbacks from `useCompiledColumns`.
The title and subtitle are literal text; badges, metrics and footer values use
the shared cell renderer and configured color rules. Empty sections are omitted.

Import the package stylesheet for responsive card layouts and light/dark themes.
Optional `actions` accepts host-rendered controls; no placeholder action button
is shown when omitted. The Next.js list uses this renderer and retains query,
filter, sort, export and settings adapters. A complete portable list widget
registry is still separate from this presentational primitive.

### Portable list widget registry

`createDataListRegistry(options)` is exported from `./react`, `./embed` and the
self-contained browser runtime. It registers `data_list`, using the shared
`DataTableRegistryOptions` translations, templates and export callback. Saved
widgets must include `columns` and a complete `cardLayout`; malformed or missing
layouts display the configured error message.

Static rows and named planner/saved-query results compose with filter pills,
sorting, row counts, CSV export and safe configured actions. Permission errors,
loading and missing query bindings clear cards. Legacy dynamic URLs and direct
pgrest modes display the migration message; query connections and credentials
belong on the dashboard server. This is a viewer registry, without widget
settings or document persistence.

### Controls inside editable grids

`DashboardGrid` excludes native buttons, links, form controls, labels, editable
text and accessible custom controls from widget dragging. Nested grid items and
`.no-drag` remain excluded. Plain widget backgrounds still initiate dragging
when the host authorizes edit mode. Hosts embedding their own nested grid can
reuse `DASHBOARD_DRAG_CANCEL_SELECTOR` from `./core`; Next.js container widgets
use the same selector for both container layouts.

### Status statistic

`StatusStat` from `./react` renders literal `title`, `value`, optional `subtitle`
and an optional decorative React `icon`. Hosts provide resolved `borderColor`,
`iconColor` and `valueColor` as six-digit RGB hex strings without `#`; invalid
values use scoped light/dark theme defaults. Import the package stylesheet.
The Next.js status widget supplies its existing icons, template results and
color-rule evaluation. The component itself does not load data or execute rules.

`createStatusStatRegistry(options)` from `./react`, `./embed` or `./browser`
registers `stat_status` for static JSON or named planner results. It resolves
`title`, `value` and `subtitle` through the supplied template engine and clears
values during loading or errors. Legacy direct-query bindings require migration.

```ts
interface StatusStatRegistryOptions {
  defaultTitle: string;
  loadingLabel: string;
  errorLabel: string;
  unsupportedDataLabel: string;
  renderIcon?: (name: string) => ReactNode;
  templateEngine?: ReturnType<typeof createTemplateEngine>;
}
```

All labels come from the host. `renderIcon` receives the saved icon name (default
`check`); use an own-key lookup with a fallback for unknown names. Without this
callback the statistic renders without an icon. No icon library is bundled.
`valueColorRules.rules` uses the existing operators and threshold ordering, with
`targets` (`border`, `icon`, `text`) or the legacy single `target`; missing or
invalid targets default to text. Rules override the `showColor`/`color` base
independently per target. Colors must be six-digit RGB without `#`.

### Icon statistic

`IconStat` from `./react` renders a resolved string `value`, optional `title` and
`unit`, and host-provided React `icon` and `description`. Strings remain literal;
a host can supply its sanitized Markdown component as the description. Icons
are decorative and hidden from assistive technology.

`variant` selects `horizontal` (value alongside title/description) or `vertical`
(stacked text beside the icon). `scalable` uses container-relative sizing; the
parent must provide `container-type: size` and explicit dimensions. Import the
package stylesheet; colors follow the scoped light/dark theme.

Optional `containerStyle`, `titleStyle`, `valueStyle`, `descriptionStyle` and
`iconStyle` accept trusted host React CSS properties. `className` customizes the
outer card. Hosts resolve data, numeric formatting, color rules and navigation.
The Next.js icon widget uses this renderer while retaining its Markdown and
icon providers; unsafe navigation schemes do not create links.

`createIconStatRegistry(options)` from `./react`, `./embed` or `./browser`
registers `stat_icon` with static JSON or named planner bindings. Configuration
fields `title`, `value`, `unit`, `subtitle` and `goToUrl` use the instance's
Handlebars engine. Invalid/nonfinite numeric values display as zero.

```ts
interface IconStatRegistryOptions {
  defaultTitle: string;
  loadingLabel: string;
  errorLabel: string;
  unsupportedDataLabel: string;
  renderIcon?: (name: string) => ReactNode;
  renderDescription?: (text: string) => ReactNode;
  formatValue?: (value: number) => string;
  templateEngine?: ReturnType<typeof createTemplateEngine>;
}
```

Descriptions default to literal text; the host may supply a sanitized rich-text
renderer. Icons use a host callback (default key `cart`); `showIcon: false` hides
them. `cardVariant: "vertical"` stacks text, and `expandable: true` establishes
container-based scaling automatically. `valueColorRules.rules` targets `text`,
`bg` and `icon`, overriding enabled manual color settings per target. Only
six-digit RGB colors are accepted. Background colors retain 80% opacity.

`showGoTo: true` enables safe native links in viewer mode; bare paths are rooted
at `/`, unsafe schemes are rejected, and edit mode disables links. Hosts remain
responsible for destination authorization. Loading/error states clear content
and navigation. Legacy direct-query bindings display the migration label.

### Sensitive statistic

`SensitiveStat` from `./react` displays a resolved string `value` under `title`.
It defaults to masked; `sensitive: false` starts visible. Required `showLabel`
and `hideLabel` localize the native toggle; optional `hint`, `showIcon` and
`hideIcon` customize its presentation. Each instance has distinct accessible
control identifiers. Masked values are not included in the rendered card DOM.

Changing `resetKey`, title, value or sensitive mode resets disclosure. Hosts
must change `resetKey` when switching document, tenant or session (or unmount
the dashboard). Optional `valueClassName` and trusted React `valueStyle` apply
only to the revealed value, allowing host threshold styles. Import the scoped
stylesheet for light/dark styles.

This is visual privacy, not authorization or encryption: the host already has
the value in memory. Enforce permissions on the server before sending data.
Next.js retains its data, formatting and threshold providers and supplies
translated reveal labels through this shared renderer.

`createSensitiveStatRegistry(options)` from `./react`, `./embed` or `./browser`
registers `stat_sensitive` with static JSON and named planner results. It resolves
`title`, `value`, `unit` and the enabled threshold field through Handlebars.
`isSensitive` defaults to true. Loading and errors unmount the card and clear
its disclosure state; data is masked again on recovery. Switch host identity
using the mount `instanceKey` or unmount before changing authorization context.

```ts
interface SensitiveStatRegistryOptions {
  defaultTitle: string;
  defaultUnit: string;
  showLabel: string;
  hideLabel: string;
  hint?: string;
  loadingLabel: string;
  errorLabel: string;
  unsupportedDataLabel: string;
  locale?: string;
  formatValue?: (value: string, unit: string) => string;
  templateEngine?: ReturnType<typeof createTemplateEngine>;
}
```

Default formatting prefixes the unit and formats finite numbers to two decimal
places using `locale`; other values stay literal. Override `formatValue` for
host-specific unit placement. Thresholds require `enabled: true` and a nonempty
`field`; the first matching rule in saved order supplies the revealed text
color when `applyTo` includes `text` (the default target). The portable scalar
palette supports red, yellow, green, blue, orange, purple and gray plus validated
hex colors. No threshold color is exposed on the masked value. Legacy query
bindings require migration to saved queries.

### Stacked statistic

`StackedStat` from `./react` renders `items: readonly StackedStatItem[]` as an SVG
stacked bar or donut (`chartType: "bar" | "donut"`). Each item has a literal
`label`, numeric `value` and six-digit RGB `color` without `#`. Invalid colors
use gray. `title` labels the chart; `showHeader: false` hides its visual header.
Optional `unit` and `formatValue(value)` control value labels.

A visible text legend exposes every item; SVG segment titles provide native
hover tooltips without interpreting labels as HTML. This renderer adds no chart
library dependency or body tooltip nodes. The Next.js stacked widget uses the
same component and retains its data/template adapter. The prior ECharts hover
animation is replaced by native SVG tooltips.

Areas use positive finite values only; negative values remain in the legend,
and nonfinite values display as zero. Empty/all-zero data renders a neutral
track. Normalizing by the largest value avoids overflow for very large totals.
Import the package stylesheet for scoped light/dark rendering.

`createStackedStatRegistry(options)` from `./react`, `./embed` or `./browser`
registers `stat_stacked`. Required options are `defaultTitle`, `defaultUnit`,
`loadingLabel`, `errorLabel`, `unsupportedDataLabel` and `emptyLabel`; optional
`formatValue(number)` and `templateEngine` customize formatting and templates.

Saved `items` contain string `label`, string/number `value` and optional string
`color`. Labels and values resolve against static JSON or the first row of the
named planner result, including the `row` alias. This also enables templates
for static configurations. Colors accept an optional leading `#`; the renderer
validates the resulting RGB. Invalid item entries are skipped and an empty list
shows `emptyLabel`. `showHeader` defaults to true and `chartType` defaults to
`bar`; `donut` selects the ring. Loading and errors remove stale segments.
Legacy direct queries display the migration label.

### Expandable statistic

`ExpandableStat` from `./react` accepts resolved `title`, string `value`, optional
`unit`, and `details: readonly { label: string; value: string }[]`. Required
`showLabel` and `hideLabel` localize its native disclosure button. Values remain
literal text, including repeated detail labels. Expanded details use semantic
term/definition markup and each instance has distinct accessible control IDs.

Optional `valueColor` and `backgroundColor` accept six-digit RGB without `#`;
invalid colors fall back to the scoped theme. Background rules tint the card,
button and expanded section. Change `resetKey` when the dashboard identity
changes to collapse its details. Data and formatting remain host responsibilities.
Next.js consumes this renderer with existing value/color rules and EN/ES labels.

`createExpandableStatRegistry(options)` from `./react`, `./embed` or `./browser`
registers `stat_expandable` for static JSON and named planner results. Required
options are `defaultTitle`, `defaultUnit`, `showLabel`, `hideLabel`, `loadingLabel`,
`errorLabel` and `unsupportedDataLabel`. Optional `formatValue(string)` and
`templateEngine` customize display and Handlebars helpers.

Templates apply to `title`, `value`, `unit` and each saved detail's `label` and
string/number `value`, using the first planner row or static data. Malformed
details are skipped. Finite numeric main values normalize like the Next.js
adapter; other values remain literal text. Value rules target `text` and `bg`,
with text rules taking precedence over `valueColor`. Loading/errors clear the
card and its disclosure state; recovery starts collapsed. Change the host mount
`instanceKey` (or unmount) when switching authorization context. Legacy direct
queries display the migration label.

### Detailed statistic

`DetailedStat` from `./react` renders resolved `title`, `value`, `description`,
`previousValue`, `target` and `changeLabel` strings as literal text. The host
formats amounts/units and supplies `positive` for the trend direction. Required
`progress` is a percentage; the renderer clamps it to 0–100 and uses zero for
non-finite inputs, including its accessible progressbar value.

Required `progressLabel`, `progressSummary` and `previousLabel` are host-translated
strings. Optional `valueColor`, `barColor` and `badgeColor` accept six-digit RGB
without `#`; invalid colors use the theme defaults. The scoped stylesheet
supports light/dark hosts without a chart or icon dependency. Next.js consumes
this component while retaining its current query resolution and field-comparison
color rules. This presentation component does not fetch data or calculate trends.

`createDetailedStatRegistry(options)` from `./react`, `./embed` or `./browser`
registers `stat_detailed` for static JSON and named planner results. Required
options: `defaultTitle`, `defaultUnit`, `progressLabel`, `previousLabel`,
`progressSummary(percent)`, `loadingLabel`, `errorLabel`, `unsupportedDataLabel`.
Optional `formatValue(number, unit)`, `formatChange(percent, positive)` and
`templateEngine` customize display and helpers.

The registry resolves title, description, value, previousValue, target and unit
against the first planner row or static data. Non-finite amounts become zero;
a zero previous value gives zero percent change and a nonpositive target gives
zero progress. Color rules target text, bar or badge and support static values
or `compareMode: "field"` with `previousValue` (default) or `target`. Invalid
comparison definitions are skipped. Loading/errors clear stale amounts; legacy
direct queries show the migration label. Default number formatting uses the
host locale and places the unit first; supply formatters for another convention.

### Sparkline statistic

`SparklineStat` from `./react` accepts resolved `title`, formatted string `value`,
optional `unit` and `values: readonly number[]`. The mini SVG line and area use
scoped styles with no chart dependency. Non-finite samples leave gaps; fewer
than two adjacent finite samples produce no line. Extreme finite values are
scaled before calculating coordinates to avoid overflow.

Optional `trendLabel` is a host-translated summary that exposes the SVG as an
accessible image. Without it the trend is decorative. `valueClassName` and
`valueStyle` are trusted host styling slots; `--miot-sparkline-color` controls
the line and fill. Next.js retains query resolution, saved sample defaults,
number formatting and threshold evaluation while using this renderer.

`createSparklineStatRegistry(options)` from `./react`, `./embed` or `./browser`
registers `stat_sparkline` with static JSON and named planner results. Required
options: `defaultTitle`, `defaultUnit`, `loadingLabel`, `errorLabel` and
`unsupportedDataLabel`. Optional `locale`, `formatValue(number)`, `templateEngine`
and `trendLabel(samples)` customize formatting and accessibility.

Saved `sparkline` entries may be numbers or templates resolved against static
data or the first planner row. Invalid/empty samples create gaps. A missing or
shorter-than-two array uses `defaultSamples` only when explicitly supplied by
the host; otherwise no trend is drawn. No query history is inferred from a
current scalar value. Title/value/unit and threshold fields resolve through the
same template engine. Text thresholds use the portable validated palette.
Loading/errors remove stale trends; legacy direct queries show the migration
label. Hosts should label configured sample series accurately.

### Information card

`InfoCard` from `./react` renders literal `title`, `value`, `descriptor` and
`footer` strings, optional host `icon`, and nested `children`. Optional trusted
`iconStyle`, `valueStyle` and `descriptorStyle` customize its scoped light/dark
presentation. It has no icon, router or application component dependency.

Supply translated `addDetailLabel` and `viewMoreLabel`. The add-detail button
requires `editMode`, `onAddDetail` and no child content. The host must derive edit
mode from authorization. Optional `viewMoreUrl` accepts relative or HTTP(S)
links only; unsafe schemes are omitted. Links open in a protected new tab unless
`openInSameTab` is true. Next.js retains hybrid data-provider templates, rules,
icons and nested widget ownership while consuming this renderer.

`createInfoCardRegistry(options)` from `./react`, `./embed` or `./browser` binds
`info_card` to static JSON, data-provider entries and named planner results.
Required options: `defaultTitle`, `addDetailLabel`, `viewMoreLabel`,
`loadingLabel`, `errorLabel`, `unsupportedDataLabel`. Optional `renderIcon(name)`
and `templateEngine` supply host icons and template helpers.

Title, value, descriptor, footer (`aiPlaceholder`), link and link label resolve
through the shared template context. Provider entries use `data_provider.key`;
query/static fields are available directly and through `row`. Text/icon rules override manual CSS colors;
manual colors remain restricted to React color style properties. Nested widgets
use the host registry, with add-detail actions gated by WidgetRenderer editing
capabilities. Loading/errors remove stale content and links. Direct legacy
queries show the migration label. No AI generation is performed for footer text.


### Chart color palettes

The React-free `./core` entry exports `ChartColorPalette`, the frozen
`CHART_COLOR_PALETTES` catalog and `getChartColors(palette, customColors?)`.
Palette names are `default`, `cool`, `warm`, `monochrome`, `pastel`, `vivid`
and `custom`. The function returns a fresh array; changing it never changes
another dashboard or the host's custom color array. Empty custom palettes and
unrecognized stored names fall back to the default palette. Both Next.js chart
families consume these helpers. This export provides colors, not a chart renderer.

`filterChartRowsByDateRange(rows, dateColumn, range, now?)` and
`ChartDateRange` are also exported from `./core`. Ranges are `all`, `7d`,
`30d`, `90d`, `180d` and `1y` (365 elapsed days). Cutoffs are inclusive;
future rows remain visible, matching existing charts. Bounded ranges discard
missing/invalid dates. `all` and unknown saved values return the original array.
Pass an epoch-millisecond `now` to share a consistent clock across dashboards.
Dates with explicit UTC offsets avoid browser-dependent local date parsing.


### Chart card

`ChartCard` from `./react` supplies the themed chart container used by both
Next.js chart families. Props are `title?: string`, `toolbar?: ReactNode`,
`children: ReactNode`, and `onResize?: (width: number, height: number) => void`.
Import the package stylesheet. The parent must provide a height.

The callback receives the card’s layout dimensions (including its padding) on
mount and resize, unaffected by CSS transform scaling. Keep the callback stable
with `useCallback`. A ResizeObserver tracks element resizing; environments without
it fall back to window resize. Cleanup disconnects observers and listeners and
ignores queued callbacks after unmount. Hosts own chart engine initialization,
option building, accessible chart descriptions and engine disposal. No chart engine
is bundled by this component. Title text renders literally; toolbar and chart are
host-owned React slots.


### Plain-text chart tooltips

`createChartTooltipFormatter(template, rows, engine?)` from `./templates` compiles
a template once and returns a formatter for ECharts item parameters. Both Next.js
chart families use it with `renderMode: "richText"` and `confine: true`. Custom
tooltip templates are text, including literal markup; they do not render HTML.
Newlines remain newlines. Filtered pie data supplies its original `rowIndex`, and
scatter data retains the original index in its third coordinate, including when
wrapped with item color styling. Invalid/out-of-range indices return empty text.

`createTemplateEngine().compileTextTemplate(template)` is the underlying plain-text
compiler. It disables HTML escaping while retaining prototype access restrictions.
Its output must only be used as text (React children, textContent, or a non-HTML
chart renderer), never innerHTML or an HTML-mode tooltip. Existing `resolveField`
and `compileTemplates` retain their HTML-escaping behavior.


### Chart options (original chart configuration)

`buildLegacyChartOption(config, rows, darkMode?, noDataLabel?, containerWidth?, host?)`
from `./charts` builds ECharts options for the original `chart` widget: line, bar,
scatter, pie and gauge. `LegacyChartOptions`, `ChartType`, `ChartSeries`,
`ChartXAxisDateFormat` and `ChartOptionHost` are exported alongside it. This
entry builds options only; hosts create, resize and dispose the chart engine.
Install ECharts 6 when consuming its option types or rendering charts. It is an
optional peer and is never imported at runtime by the library. The standalone
browser bundle does not include a chart engine.

Existing series labels, palettes, horizontal bars, stacking, smoothing, bar labels,
legend, zoom and dark styles are preserved. Missing/nonfinite numeric values become
line/bar gaps or are omitted from scatter/pie points. Gauge uses the first row.
Custom tooltips use the plain-text formatter described above.

The optional `host` contains `formatDateLabel(value): string` and
`colorForValue(value): string | undefined`. Date labels stay as supplied unless
the host explicitly formats them; there is no implicit locale or time zone.
Next.js supplies its existing es-CL/America/Santiago formatter and saved color-rule
evaluator. Pass a translated `noDataLabel` and the measured width for label rotation.
The mixed-series `chart_v2` builder is described below.


### Mixed chart options

`buildMixedChartOption(config, rows, darkMode?, noDataLabel?, containerWidth?, host?)`
from `./charts` accepts `MixedChartOptions` and `ChartRepresentation[]`. It supports
cartesian combinations of line, bar and scatter with per-series smoothing, stacking,
bar labels, colors and left/right Y-axis selection. `ChartFamily` is `cartesian`,
`pie` or `gauge`; pie/gauge share the original builder's behavior.

Custom colors take precedence over representation colors, then the selected palette.
Point color rules are supplied through `host.colorForValue`. Scatter uses category
indices and disables horizontal layout, matching the existing `chart_v2` widget.
The same explicit date formatter and plain-text tooltip contract apply. Both Next.js
chart families now consume public option builders; query/planner integration and
engine lifecycle remain with their host adapters.


### Chart engine lifecycle

`ChartEngineView<Option>` from `./react` takes `option`, a descriptive `ariaLabel`,
and a stable `createEngine(element)` factory. The factory returns `ChartEngine<Option>`:
`update(option)`, `resize()`, `dispose()` and optional `hideTooltip()`.
`update` must replace obsolete data/series; for ECharts use
`instance.setOption(option, { notMerge: true })`. Changing factory identity disposes
the old engine and creates a new one. Ordinary option updates reuse the instance.

The component observes its plot size, falls back to window resize when needed,
hides tooltips on pointer leave and disposes the engine on removal, including
React Strict Mode replay. Import the stylesheet and provide a sized parent (for
example `ChartCard`). Keep interactive controls outside its image-labelled plot.
Hosts own engine selection, engine-specific events and chart descriptions.
Both Next.js chart families use this bridge with the app's ECharts canvas adapter;
the library does not import or bundle the engine. Engine exceptions propagate to
the host's React error boundary.


### Portable chart registry

`createChartRegistry(options)` from the opt-in `./react-charts` entry registers
`chart` and `chart_v2` for `WidgetRenderer`/dashboard hosts. Supply a stable
`createEngine(element)` adapter, translated `defaultTitle`, `loadingLabel`,
`errorLabel`, `unsupportedDataLabel`, `emptyLabel`, and `rangeLabels` keyed by
`all`, `7d`, `30d`, `90d`, `180d`, `1y`. Optional settings are `formatDateLabel`,
`describeChart(title, rows)`, `darkMode`, `now` and `templateEngine`.

Static widgets use `rows`. Planner widgets read `plannerVariableName` from the
shared `PlannerResultsProvider`; use the existing saved-query provider for server
execution. Titles, axes and series labels resolve against the first source row,
active filters and `data_provider`. Date controls filter displayed rows locally.
Saved item color rules, chart options and source-row tooltip mapping are preserved.
The registry validates configuration and uses read-only widget metadata. Query
loading, errors or legacy unsupported modes unmount the chart, disposing its engine
and clearing stale data. Direct `pgrest` execution is not provided; migrate it to
connection/template/credential-backed named server queries.

Import `./react-charts` alongside the normal `./react` entry; it shares their
provider contexts. This optional entry references ECharts option types and expects
an engine adapter, but does not load the engine. Plain browser hosts can use `./browser-charts`, described below; the default
`./browser` entry stays smaller and omits the chart registry.


### Native browser charts

Use `./browser-charts` instead of `./browser` when a plain HTML or LiveView host
needs charts. It exports the same mounting/Web Component APIs plus
`createChartRegistry`. The bundle includes its own shared React runtime, so the
host needs no React installation, JSX, import map or app framework. Supply
`createEngine` through registry options using the host's separately loaded chart
engine. Prefer selective ECharts modules for the chart families you need.

Use a single browser entry for a mounted dashboard: import both `mountDashboard`
and `createChartRegistry` from `./browser-charts`. Mixing independently bundled
browser runtimes can duplicate React and provider contexts. The default browser
bundle remains available for hosts that do not need charts. Both artifacts are
checked for unresolved imports and can be imported without a DOM.

### Portable settings panel

`SettingsPanel` from `/react` renders host-supplied settings tabs (or a single pane), footer and save action. Supply translated `tabsLabel` and `saveLabel`, `isDirty`, and `onSave`; `disabled` blocks saving during persistence or when the host lacks editing authority. Tab navigation supports arrows, Home and End, with instance-local accessible IDs. The host owns form state, permission checks, validation, persistence, dialogs and dismissal. Import the package stylesheet.

`useSettingsDirty(isOpen, snapshot)` compares JSON-serializable form fields against the baseline captured after opening effects settle. Keep one `DirtySettingsProvider` per form/editor instance; `useDirtySettings()` exposes the form's dirty state and current save-and-close callback. Register the callback in an effect and clear it with `registerSaveAndClose(undefined)` on cleanup. Hosts remain responsible for unsaved-change confirmation and successful-save dismissal. Snapshots must be acyclic JSON data; property order affects equality.

### Named query binding selector

`QueryBindingSelector` from `/react` accepts host-discovered `options` (`id`, unique `variableName`, optional `schema`), a controlled `value` and `onChange`. Provide translated labels (`label`, `placeholder`, `emptyLabel`, `columnsLabel`, `unavailableLabel`) and optional `schemaHint`. It displays available columns and calls `onSchemaDetected` with a copy when the user selects a known result. Removed bindings remain visible as unavailable until the user chooses a replacement. `disabled` supports read-only hosts. This selector performs no discovery, credential access or queries; the host supplies authorized metadata. It can use saved-query or legacy planner definitions through adapters.

### Saved query authoring

`SavedQueryEditor` from `/react` edits a `DashboardQueryDefinition` against host-provided `connections` and their approved `operations`. Supply translated `labels`, `existingQueries` for duplicate-name checks and `onSave` to update the host document draft. It defaults to read-only; pass `editable` only from host capabilities. Parameters use shared-contract JSON literal/filter bindings. Switching a connection or operation clears stale parameters and response schema. Invalid or unavailable operations cannot be saved. The host owns catalog discovery, credentials, server authorization and document persistence/ETags. Remount with a new React `key` when changing query, dashboard or identity. This component does not issue network requests.

`useDashboardState` exposes `queries` and `setQueries(definitions)` for saved-query authoring with shared undo/redo. Updates return `false` for read-only/unloaded hosts, invalid definitions, duplicate IDs/names or more than 50 queries; accepted definitions are parsed into independent draft data. Catalog authorization and server persistence remain host responsibilities.
