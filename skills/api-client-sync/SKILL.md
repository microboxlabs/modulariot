---
name: api-client-sync
description: >
  Sync a hand-authored TypeScript API client package with a changed OpenAPI spec.
  Use when the user says the openapi.json has changed and needs to be reflected in the
  client SDK — updating types, adding resource methods, writing tests, bumping the
  version, and committing. Triggers on phrases like "update the client from the new
  openapi", "sync the client with the API spec", "implement the api changes in the
  client", or "the openapi.json changed, update the client package".
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

## Key rules

- **Never auto-generate types.** This package is hand-authored — preserve the same style and conventions.
- Optional fields (`?`) for anything not in the OpenAPI schema's `required` array.
- `void` return type for 204 No Content responses.
- A new endpoint always produces a new method. A new field never produces a new method.
