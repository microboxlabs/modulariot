# @microboxlabs/miot-dashboard-contract

The MIOT dashboard document and its HTTP API: types, zod schemas, the role and
capability vocabulary, the error envelope, and an OpenAPI 3.1 document.

```sh
npm install @microboxlabs/miot-dashboard-contract
```

## Entry points

There is no root entry. Import the subpath you need.

| Import                             | Holds                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `.../document`                     | Document types, `GRID_COLS`, `DEFAULT_STORAGE`                             |
| `.../schema`                       | zod schemas, `validateDashboardConfig`, `CURRENT_DASHBOARD_CONFIG_VERSION` |
| `.../roles`                        | `DashboardRole`, `DashboardCapabilities`, `roleAtLeast`, `highestRole`     |
| `.../errors`                       | `ErrorEnvelope`, `DashboardErrorCode`, `STATUS_BY_CODE`                    |
| `.../lint`                         | `lintDashboardConfig`, `deliveredFilterNames`, `DashboardProblem`          |
| `.../catalog`                      | Query catalog types (`DashboardQueryCatalogResponse`)                      |
| `.../openapi.yaml`                 | The OpenAPI 3.1 document                                                   |
| `.../dashboard-config.schema.json` | JSON Schema for the document                                               |

`document`, `roles`, `errors` and `catalog` are types and constants only.
`schema` and `lint` load zod.

## Validate a document

```ts
import { validateDashboardConfig } from "@microboxlabs/miot-dashboard-contract/schema";

const result = validateDashboardConfig(await request.json());
if (!result.valid) {
  return Response.json({ error: result.problems.join("; ") }, { status: 400 });
}
await store.save(ref, result.config);
```

`problems` are strings of the form `path: message`, dotted from the document
root (`widgets.0.layout.x`). They are not zod issues, so your code is not tied
to this package's version of zod.

## Lint a document

A document can match the contract and still show nothing, for example when a
query parameter is bound to a filter name that no filter delivers.
`lintDashboardConfig` finds these cases.

```ts
import { lintDashboardConfig } from "@microboxlabs/miot-dashboard-contract/lint";

const { valid, problems } = lintDashboardConfig(document, catalog);
```

It runs `dashboardConfigSchema` first. If that fails, it returns the contract
issues as problems with rule `contract` and applies no other rule. `catalog` is
optional and has the shape of the `GET …/query-catalog` response. `valid` is
false when any problem has severity `error`.

Each problem is `{ rule, path, message, severity }`. `path` is dotted from the
document root, as in `validateDashboardConfig`.

**Names a filter delivers** (`deliveredFilterNames`):

| Filter type      | Delivers                 |
| ---------------- | ------------------------ |
| `text`, `select` | `<key>`                  |
| `date_range`     | `<key>_from`, `<key>_to` |

**Rules:**

| Rule                 | Severity | Reports                                                                                                    |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `contract`           | error    | The document does not match the zod schema.                                                                |
| `filter-key-unique`  | error    | Two filters with the same key.                                                                             |
| `query-id-unique`    | error    | Two queries with the same id.                                                                              |
| `filter-binding`     | error    | A `filter` parameter whose key no filter delivers. The message lists the delivered names.                  |
| `date-range-binding` | error    | A `filter` parameter bound to the bare key of a `date_range` filter.                                       |
| `widget-query`       | error    | A widget with `dataMode: "planner"` whose `plannerVariableName` matches no `queries` or `requestPlanner` variable. |
| `operation-exists`   | error    | A query whose connection or operation is not in the catalog. Only with a catalog.                          |
| `filter-unused`      | warning  | A filter whose delivered names no query reads. A `{{filter.x}}` template in a `requestPlanner` value counts as a read. |
| `column-exists`      | warning  | A chart column that the operation's catalog `schema` does not list. Only with a catalog.                   |

`column-exists` checks `xAxisColumn` and `series[].columnKey` of `chart`, and
`xAxisColumn` and `representations[].columnKey` of `chart_v2`. It does not
check tables, because their column keys are templates. It skips widgets bound
to a `requestPlanner` variable and operations without a `schema`.

When a server rejects a document, `ErrorEnvelope.problems` carries these
problems. `POST …/dashboards/{slug}/validate` returns
`{ data: { valid, problems } }` and saves nothing.

## Compare roles

Four roles, ordered: `Consumer`, `Contributor`, `Editor`, `Coordinator`. A
higher role grants at least what every lower one does.

```ts
import { roleAtLeast } from "@microboxlabs/miot-dashboard-contract/roles";

roleAtLeast("Editor", "Contributor"); // true
```

## Document behaviour

**Unknown keys pass through**, at every level. A document written by a newer
version survives a load-validate-save round trip with its fields intact.

**An unrecognised `version` is refused.** Nothing here migrates a document.
The current version is `2`.

## Connection-backed queries

The optional `queries` array describes named operations independently of legacy
`requestPlanner` PostgREST paths. Each `DashboardQueryDefinition` has `id`,
`variableName`, `connectionId`, `operationId`, `parameters` and optional column
`schema`. No credential, endpoint or SQL is required in the dashboard document.

```json
{
  "id": "costs",
  "variableName": "costsByService",
  "connectionId": "billing",
  "operationId": "cost-summary",
  "parameters": {
    "days": { "kind": "literal", "value": 30 },
    "service": { "kind": "filter", "key": "service", "defaultValue": null }
  }
}
```

Values are finite JSON scalars or flat arrays of scalars, never expressions or
nested objects. Validation limits documents to 50 queries, identifiers to 128
characters, string values to 2048 characters, and arrays to 100 values. Existing
version-2 documents without `queries` remain valid.

This is a document contract, not permission to execute an operation. A supporting
server must authorize the dashboard, resolve bindings from the saved document,
validate filter inputs, and enforce execution/result limits. The host must resolve
the connection within the authorized tenant and apply operation schemas,
credentials and tenant predicates. Schema validation alone does none of that.

## Serving the two documents

`openapi.yaml` refers to `dashboard-config.schema.json` by bare filename, so
serve them as siblings. `@microboxlabs/miot-dashboard-server` serves them at
`/openapi.yaml` and `/dashboard-config.schema.json`.

## Development

The zod schemas are the source of truth. After editing one:

```sh
npm run schema:build   # rewrites contract/dashboard-config.schema.json
npm test
```

`npm test` fails when the committed JSON Schema no longer matches the zod
schemas, or when the OpenAPI document and the TypeScript vocabulary disagree.

## Licence

Apache-2.0.

## Test coverage

Run `npm run test:coverage` in this package to generate `coverage/lcov.info`
and a coverage summary. The SonarCloud workflow runs both dashboard packages
and imports these reports; LCOV paths are relative to the `turbo-repo` root.

### Optional query filters

Filter bindings may set `omitWhenEmpty: true` to omit a parameter whose resolved
value is missing or an empty string. A missing filter first uses `defaultValue`,
when present; an explicit empty string does not use the default. Null, false, zero,
empty arrays, whitespace and operator strings are preserved. Existing bindings
keep their required/default behavior. The host operation schema must allow the
parameter to be absent; tenant predicates remain host-controlled. Upgrade both
contract and server to a release containing this option before using it; 0.3.0
does not implement omission.

## Scope creation eligibility (v0.5.0)

The OpenAPI contract includes `GET /tenants/{tenantId}/scopes/{scopeId}/capabilities`,
which returns `{ canCreate: boolean }` for an authenticated scope member.
It describes scope-role and credential eligibility, not authorization for a
particular document. Saving still applies document policy and validation.
Embed tokens cannot call this endpoint. Use server v0.5.0 or later to serve it.

## Dynamic filter option metadata (v0.6.0)

`DashboardFilterParam` includes optional `single: boolean` and
`optionsSource: { variableName, valueField, labelField? }`. The source references
an already authorized named result; it supplies no endpoint, SQL or credentials.
`labelField` defaults to `valueField`. Portable hosts use saved-query variables;
legacy hosts may supply planner results through their adapter. The contract only
validates metadata shape: result projection, loading states and selection behavior
belong to the UI. Blank legacy source fields remain readable; authoring interfaces
should require complete references. Existing extension fields remain preserved.

## Query catalog parameters (v0.7.0)

A catalog operation may list `parameters: { name, required?, description? }[]`,
the values the operation reads. Hosts that do not publish them omit the field.
