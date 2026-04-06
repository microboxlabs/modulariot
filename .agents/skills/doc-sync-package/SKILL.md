---
name: doc-sync-package
description: Sync documentation after changes to a publishable package under packages/. Use when the user says "update the docs", "document this", "sync the docs", or "reflect these changes in the docs" after modifying a package. Updates the package README, the EN and ES SDK reference pages, and the EN and ES changelogs.
---

# doc-sync-package

Keep all documentation in sync after changes to a publishable package in this monorepo.

## When to Use

Use this skill when the user wants to:

- Sync docs after modifying a package (new features, changed types, new API methods)
- Update the docs to reflect a new package version
- Find and fill documentation gaps after a package change

Do NOT use this skill for `apps/app` changes, architectural decisions, or backend API changes — those affect different doc sections and require a different approach.

## Doc Structure Overview

Every package change potentially touches **five files**. Always treat all five as candidates and verify each one:

| File | Purpose | Depth |
|---|---|---|
| `packages/<name>/README.md` | npm-facing full API reference | Full method tables, full type blocks |
| `apps/docs/content/en/reference/sdks/<name>.mdx` | Docs site summary page (EN) | Feature bullets + link to README |
| `apps/docs/content/es/reference/sdks/<name>.mdx` | Docs site summary page (ES) | Same as EN, in Spanish |
| `apps/docs/content/en/reference/changelog.mdx` | Changelog (EN) | One entry per release |
| `apps/docs/content/es/reference/changelog.mdx` | Changelog (ES) | Same as EN, in Spanish |

**Critical rule:** The docs site pages are **summary-level only** — they describe capabilities in plain language and link to the README for method-level details. Never duplicate full API tables or type blocks into the MDX pages.

## Instructions

### Step 1: Understand the Changes

Run a diff against the base branch to understand exactly what changed in the package:

```bash
git diff trunk -- packages/<name>/
```

If the package has an `openapi.json`, diff it too — it's the most reliable source of truth for API changes:

```bash
git diff trunk -- packages/<name>/openapi.json
```

From the diff, identify:
- **New resource namespaces** (e.g. a new `groups` property on the client)
- **New or changed methods** within existing namespaces
- **New or changed query params** on existing methods
- **New, removed, or changed fields** on request/response types
- **New types** added to `src/types.ts` and exported from `src/index.ts`
- **Version bump** in `package.json`

### Step 2: Read All Five Doc Files

Read all five files in parallel before making any edits:

```
packages/<name>/README.md
apps/docs/content/en/reference/sdks/<name>.mdx
apps/docs/content/es/reference/sdks/<name>.mdx
apps/docs/content/en/reference/changelog.mdx
apps/docs/content/es/reference/changelog.mdx
```

If a docs site MDX page does not yet exist for the package, create it following the template in the **SDK Page Structure** section below.

### Step 3: Identify Gaps

For each file, verify whether a gap actually exists before planning an edit. Do not edit files where the content is already accurate.

**README gaps to check:**
- Method param tables missing new query params
- `create()` / `update()` body tables missing new fields
- New resource namespace entirely absent (no section for it)
- Type blocks (`interface Foo`) stale — missing new fields or new types not yet added
- Install/Quick Start example still references old version behavior

**SDK docs page gaps to check:**
- Features section missing a bullet for a new capability
- Existing feature bullet describes a capability that has changed meaningfully
- Overview paragraph still accurate

**Changelog gaps to check:**
- No entry for the new version
- Entry exists but is missing key changes

### Step 4: Update the README

The README is the authoritative reference for all method signatures and types. Apply the following rules:

**Methods:**
- Each namespace gets its own `### <Namespace>` section
- Each method gets its own `#### <namespace>.<method>(params)` subsection
- New params go in the param table with their type, Required column, and description
- Preserve existing methods — only add or update, never remove unless something was actually deleted

**Types section:**
- Each exported interface/type gets its own `### <TypeName>` subsection with a fenced `ts` code block
- New fields go inside the existing code block with inline comments
- New types get their own new subsection, inserted in a logical place (request types before response types; group-related types together)

**Ordering for new namespace sections:**
Insert new sections in an order that reflects conceptual grouping — organizational/grouping resources before the items they contain (e.g. Groups before Calendars, not after Bookings).

### Step 5: Update the EN SDK Docs Page

The EN MDX page lives at `apps/docs/content/en/reference/sdks/<name>.mdx`.

**Features section:** Add one short paragraph per new top-level capability. Write in plain language, no method signatures. Reference the client namespace (e.g. `client.groups`) so readers know where to look, but don't list individual methods.

**Do not add:**
- Full method param tables
- Type code blocks
- Error code tables

These all belong in the README. The MDX page ends with a link to the README on npm — that is intentional.

### Step 6: Update the ES SDK Docs Page

Apply the exact same changes as Step 5, translated into Spanish.

Keep technical identifiers (method names, interface names, field names) in their original form — only translate the surrounding prose.

### Step 7: Update the EN Changelog

The changelog lives at `apps/docs/content/en/reference/changelog.mdx`.

Insert a new entry **at the top of the `## Recent Releases` section**, above all existing entries. Use this format:

```markdown
### `<package-name>` v<version> — <Short Title> (<YYYY-MM-DD>)

**`@microboxlabs/<package-name>`** — [npm](...) | [GitHub](...)

One-sentence summary of what this release adds.

**New — `client.<namespace>` namespace:**
- `<namespace>.<method>(params)` — brief description
- ...

**Updated — `client.<existing-namespace>`:**
- `<method>()` accepts new `<param>` param — description
- `<TypeName>.<field>?: type` — description

**New types exported:** `TypeA`, `TypeB`

---
```

Only include sections that actually apply. If nothing was updated (pure addition), omit the "Updated" block.

### Step 8: Update the ES Changelog

Apply the exact same entry as Step 7, translated into Spanish, in `apps/docs/content/es/reference/changelog.mdx`.

Insert above the existing entries under `## Lanzamientos Recientes`.

---

## SDK Page Structure

If a docs page does not yet exist for a package, create it using this template.

**EN (`apps/docs/content/en/reference/sdks/<name>.mdx`):**

```markdown
# <Human Name>

<One-sentence description>.

**Status:** Available — [npm](<npm-url>) | [GitHub](<github-url>)

## Overview

`@microboxlabs/<package-name>` <paragraph describing what it does, what runtimes it supports, key design decisions>.

## Installation

\```bash
npm install @microboxlabs/<package-name>
\```

## Quick Start

\```ts
<minimal working example — create client, do one meaningful operation>
\```

## Features

### <Feature 1>
<One paragraph.>

### <Feature 2>
<One paragraph.>

## Configuration

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `baseUrl` | `string` | Yes | Base URL of the API |
| `headers` | `Record<string, string>` | No | Default headers for every request |
| `fetch` | `typeof fetch` | No | Custom fetch implementation |

## Full API Reference

For complete method documentation, parameter tables, type definitions, and error code reference, see the [package README on npm](<npm-url>).
```

**ES:** same structure, all prose translated, identifiers (types, method names, field names) left as-is.

---

## Changelog Entry Date

Always use today's date in `YYYY-MM-DD` format. Do not use relative dates like "today" or "recently".

---

## Publishable Packages

| Directory | npm Name | README | SDK docs page |
|---|---|---|---|
| `miot-calendar-client` | `@microboxlabs/miot-calendar-client` | `packages/miot-calendar-client/README.md` | `sdks/miot-calendar-client.mdx` |

As new publishable packages are added, extend this table.

---

## Common Mistakes to Avoid

- **Editing without reading first.** Always read the current file content before writing. The gap may already be filled.
- **Duplicating the full API into the MDX pages.** The MDX pages are summaries. Full tables belong in the README.
- **Updating only one language.** EN and ES must always be updated together in the same session.
- **Inserting changelog entries at the bottom.** Always insert newest-first, at the top of the releases section.
- **Touching `sdks/index.mdx`.** This file only lists available SDKs and does not need updating unless a brand new package is being added for the first time.
- **Inferring paths without verifying.** The docs content root is `apps/docs/content/`, not `apps/docs/src/content/docs/` — always verify with a glob if unsure.
