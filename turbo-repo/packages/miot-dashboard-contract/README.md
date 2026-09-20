# @microboxlabs/miot-dashboard-contract

What a MIOT dashboard is, and how a client and a server talk about one.

Install this when you are replacing one of the two halves — writing a server
for our renderer, or a client for our server. Neither half is a dependency
here, so you need no Node service and no React bundle.

Using both halves as shipped? You do not need this directly. Both depend on it
already.

## What is in it

**The document.** The persisted dashboard: version, widget tree, grid layout,
filter bar, planner requests. Written as zod schemas, and as a JSON Schema
generated from them for consumers that are not TypeScript.

**The wire.** The HTTP API: paths, the error envelope, the role and capability
vocabulary, in `contract/openapi.yaml`.

| Entry                                            | Holds                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `@microboxlabs/miot-dashboard-contract/document` | The document's types, `GRID_COLS`, `DEFAULT_STORAGE`             |
| `.../schema`                                     | The zod schemas, `validateDashboardConfig`, the version constant |
| `.../roles`                                      | `DashboardRole`, the ordering, `DashboardCapabilities`           |
| `.../errors`                                     | `ErrorEnvelope`, the codes and their statuses                    |
| `.../openapi.yaml`                               | The OpenAPI 3.1 document                                         |
| `.../dashboard-config.schema.json`               | The generated JSON Schema                                        |

There is no root entry. Each import names the module that defines it, so an
access layer mapping host roles onto ours does not load zod.

## Validating a document

```ts
import { validateDashboardConfig } from "@microboxlabs/miot-dashboard-contract/schema";

const result = validateDashboardConfig(await request.json());
if (!result.valid) {
  return Response.json(
    { error: result.problems.join("; "), status: 400, code: "BAD_REQUEST" },
    { status: 400 },
  );
}
await store.save(ref, result.config);
```

`problems` are strings, not zod issues, so a host is not tied to our major
version of zod.

## Two rules for either half

**Unknown keys pass through.** A document written by a newer version must
survive a load-validate-save round trip without losing fields the reader has
never heard of. Strip them and every additive change becomes breaking.

**A version you do not understand is refused, never guessed.** Coercing a v3
document into v2 drops what v3 added, and the next save writes the loss back.

No migration function ships here, because each half does something different
about a wrong version. A renderer may coerce a legacy blob into something it
can display; our server refuses it by name so an operator can see what
exists.

## Changing it

The zod schemas are the source of truth. After editing one:

```sh
npm run schema:build   # rewrites contract/dashboard-config.schema.json
```

`npm test` fails when the committed artifact no longer matches the schemas.
Another test checks the OpenAPI document against the TypeScript vocabulary in
both directions.

The document refers to the JSON Schema by a bare filename, so the two must
stay siblings. They are, on disk and as the server serves them, at
`/openapi.yaml` and `/dashboard-config.schema.json`. Move one without the
other and the contract still renders, with a hole where the document should
be — hence the test.

## Licence

Apache-2.0.
