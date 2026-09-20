# @microboxlabs/miot-dashboard-contract

What a MIOT dashboard **is**, and how a client and a server **talk about one**.

Install this when you are replacing one of the two halves — writing a server
for our renderer, or a client for our server. Neither half is a dependency
here, which is the point: you should not have to install a Node service to
find out what it answers, or a React bundle to find out what a dashboard
document looks like.

If you are using both halves as shipped, you do not need to install this
directly. Both already depend on it, and that is what guarantees they agree.

## What is in it

Two separate agreements.

**The document.** The persisted dashboard: its version, widget tree, grid
layout, filter bar, planner requests. Described as zod schemas, and as a JSON
Schema generated from them for consumers that are not TypeScript.

**The wire.** The HTTP API: paths, the error envelope, the role and capability
vocabulary. Described in `contract/openapi.yaml`.

| Entry                                            | Holds                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `@microboxlabs/miot-dashboard-contract/document` | The document's types, `GRID_COLS`, `DEFAULT_STORAGE`             |
| `.../schema`                                     | The zod schemas, `validateDashboardConfig`, the version constant |
| `.../roles`                                      | `DashboardRole`, the ordering, `DashboardCapabilities`           |
| `.../errors`                                     | `ErrorEnvelope`, the codes and their statuses                    |
| `.../openapi.yaml`                               | The OpenAPI 3.1 document                                         |
| `.../dashboard-config.schema.json`               | The generated JSON Schema                                        |

There is no root entry. Each import names the module that defines what it
takes, so an access layer mapping host roles onto ours does not load zod to
do it.

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

`problems` are strings, not zod issues, so a host is not forced onto our major
version of zod to read an answer — and they are wanted as text anyway, since
they go into the 400.

## Two rules worth knowing before you implement either half

**Unknown keys pass through.** A document written by a newer minor version has
to survive a load-validate-save round trip in an older reader without losing
the fields that reader has never heard of. An implementation that strips them
turns every additive change into a breaking one.

**A version you do not understand is refused, never guessed.** Coercing a v3
document into v2 drops whatever v3 added, and the next save writes the loss
back. Refuse and say so.

What each half then _does_ about a wrong version is its own business, which is
why no migration function ships here. A renderer may coerce a legacy blob into
something displayable; our server refuses it by name so an operator can see
what is out there. A shared function only one side may call is a contract that
lies.

## Changing it

The zod schemas are the source of truth. After editing one:

```sh
npm run schema:build   # rewrites contract/dashboard-config.schema.json
```

`npm test` fails when the committed artifact does not match the schemas, so
forgetting is caught rather than discovered. Another test checks the OpenAPI
document against the TypeScript vocabulary in both directions — they are
written by hand in two languages, and nothing else would notice them drifting.

The document and the JSON Schema are siblings on disk, and the document refers
to the schema by a bare filename. The standalone server serves them as
siblings too, at `/openapi.yaml` and `/dashboard-config.schema.json`, so the
same reference resolves from either copy. Moving one without the other leaves
a contract with a hole where the document should be — and it still renders,
which is why there is a test for it.

## Licence

Apache-2.0.
