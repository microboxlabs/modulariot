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
| `.../openapi.yaml`                 | The OpenAPI 3.1 document                                                   |
| `.../dashboard-config.schema.json` | JSON Schema for the document                                               |

`document`, `roles` and `errors` are types and constants only. `schema` is the
one that loads zod.

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
