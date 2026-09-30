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
