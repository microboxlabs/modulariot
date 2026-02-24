---
name: api-client-sync
description: >
  Propagate OpenAPI spec changes through all three layers: (1) the hand-authored TypeScript
  client package — types, resource methods, tests, version bump; (2) the CLI package —
  commands, flags, table columns, tests, version bump; (3) the agent skill — SKILL.md
  workflows, business rules, and reference.md sections. Use when the user says the
  openapi.json has changed and needs to be reflected end-to-end. Triggers on phrases like
  "update the client from the new openapi", "sync the client with the API spec", "implement
  the api changes in the client", "the openapi.json changed, update the client package",
  "propagate the API changes", or "update all layers from the spec".
---

# API Client Sync

Propagate OpenAPI spec changes into a hand-authored TypeScript client package.
The change flows bottom-up: spec → types → resource methods → tests → version bump → commit.

## Step 1: Diff the spec

```bash
git diff <base-branch> -- <path/to>/openapi.json
```

Categorize every addition in the diff:

| Category | Example | Impact |
|---|---|---|
| New endpoint | `DELETE /calendars/{id}/purge` | New method in resource file |
| New request field | `autoSlotManager` on `CalendarRequest` | Add optional field to request interface |
| New response field | `hasSlotManager` on `CalendarResponse` | Add optional field to response interface |
| New schema | New `FooRequest`/`FooResponse` pair | New interfaces + export |
| Removed/changed | Removed field or status code | Breaking — confirm with user before proceeding |

Ignore documentation-only changes (description text, examples with no schema impact).

## Step 2: Read the package

Before writing anything, read:
- `src/types.ts` — all request/response interfaces
- `src/resources/<resource>.ts` — the relevant resource file(s)
- `src/__tests__/<resource>.test.ts` — existing tests for the resource

Read `references/client-conventions.md` for this package's specific patterns (fetcher signature, test utilities, file layout).

## Step 3: Plan

State explicitly what will change before touching any file:
- Which interfaces in `types.ts` need new fields
- Which resource file(s) need new methods and their signatures
- Which test files need new cases
- Version bump: **minor** if a new method is added; **patch** if only optional fields are added

Confirm with the user before proceeding if any removals or breaking changes are involved.

## Step 4: Implement (bottom-up)

Apply changes in this exact order.

### 4a. `src/types.ts`

Add new fields as optional (`?`) on existing interfaces. New schemas become new exported interfaces placed in the appropriate section alongside related types.

### 4b. `src/resources/<resource>.ts`

Add new methods. Each calls the shared `fetcher` with the correct HTTP verb and path. Return type must match the interface from `types.ts`. Mirror the style of existing methods in the file exactly — don't introduce new patterns.

### 4c. `src/__tests__/<resource>.test.ts`

For each new method, add a `describe` block with tests covering:
- Correct HTTP verb and URL path
- `void` / `undefined` return for 204 responses
- Body serialization for methods with a request body

### 4d. `src/index.ts`

Export any new types not already covered by a bulk export.

## Step 5: Run tests

```bash
npm run test --workspace=packages/<package-name>
```

All tests must pass before proceeding. Do not bump the version or commit if tests fail.

## Step 6: Version bump + commit

Update `version` in `package.json`, then commit:

```
feat(<package-name>): <one-line summary of changes>

- <bullet per change: new method, new field, etc.>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

### Version bump rules

| Change | Bump |
|---|---|
| New method(s) added | minor |
| Only new optional fields on existing interfaces | patch |
| Removed or renamed anything | major — confirm with user first |

## Step 7: CLI support

Check if a CLI package (e.g. `miot-cli`) consumes this client. Read `references/cli-conventions.md` for the exact file layout, handler pattern, and test structure, then:

- For each new endpoint → add a new command in the appropriate `commands/<resource>/` file and register it in `index.ts`.
- For each new optional request field → add a `--flag` (or `--no-flag` for booleans) to the relevant command.
- For each new response field that should appear in list output → add a table column to the list command.
- Run tests: `npm run test --workspace=packages/miot-cli`
- Bump version: **minor** if a new command was added; **patch** if only a flag or column was added.

## Step 8: Agent skill update

Read `references/skill-update.md` for templates and commit conventions, then update the `miot-calendar` skill (or whichever skill wraps this API):

- For each new endpoint → add a workflow to `SKILL.md` under `## Common Workflows`.
- For each irreversible or constrained operation → add a business rule to `SKILL.md` under `## Business Rules`.
- Update `references/reference.md`: add the new command to the TOC, add its full section (flag table + JSON output example).

Skills are committed directly to `trunk` — no npm version bump required.

## Key rules

- **Never auto-generate types.** This package is hand-authored — preserve the same style and conventions.
- Optional fields (`?`) for anything not in the OpenAPI schema's `required` array.
- `void` return type for 204 No Content responses.
- A new endpoint always produces a new method. A new field never produces a new method.
- **A new endpoint propagates through all three layers** (client → CLI → agent skill).
