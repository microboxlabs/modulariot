# Separating the target contract from the binding — moving `itemsFrom` out of `request_schema`

**Status:** P1 and P2 implemented. P3 planned.

## Problem

An operation's `request_schema` currently carries two unrelated kinds of knowledge:

| Kind | Example | Knowable from |
|---|---|---|
| **The target's contract** | `items` is an array of objects with `mediaId` and `notes[]` | the partner's API documentation |
| **Where the data comes from** | that array iterates our `content`, and `notes` iterates *this element's* `content.reasons` | our own event snapshot |

The second lives in `itemsFrom`, on the array node of the schema. That is a *binding*
decision stored inside the *contract*.

It was invisible while an engineer seeded each schema by hand. It stopped being invisible
once operators author templates themselves (the type/instance split): authoring a partner
contract now requires knowing the shape of the review event's internal snapshot, which is
exactly the concern a template was introduced to keep out.

### What it costs

- **A type is not reusable across producers.** The same partner API driven by an event that
  emits `records` instead of `content` needs a second template, identical except for
  `itemsFrom`. The contract is not the thing that varies; the mapping is.
- **Pasting a partner's JSON Schema is not enough**, and fails *silently*: an array with no
  `itemsFrom` defaults to `content` (`PayloadSchema.DEFAULT_ITEMS_FROM`). That is right for a
  first-level array over reviewed items and wrong for a nested one, which then binds to the
  same root as its parent. The payload still renders, so nothing complains — the only symptom
  is that the root a nested row needs is never offered for mapping. Pinned by
  `PayloadNestedRenderingTest.aNestedArrayWithoutItemsFromSilentlyBindsToContent`.
- **The hint layer inherits the leak.** `PayloadSchema.leaves()` derives each leaf's
  `contextRoot` from `itemsFrom`, and `arrayBindNames()` derives the extra template roots from
  it, so the drawer's per-row hints and its validation are only as right as the contract's
  embedded producer knowledge.

## Target model

The contract becomes **pure JSON Schema** — names, types, nesting, required. The binding
answers where every part of it comes from, arrays included.

`integration_event_bindings.field_templates` is already a flat `Map<dottedPath, template>`.
Array containers simply become mappable rows:

| Row | Kind | Template |
|---|---|---|
| `reference` | value | `{{task.serviceCode}}` |
| `items` | **collection** | `{{content}}` |
| `items.mediaId` | value | `{{content.mediaId}}` |
| `items.notes` | **collection** | `{{content.reasons}}` |
| `items.notes.code` | value | `{{reasons.code}}` |

The renderer's rebinding rule is unchanged: each element is bound under the **last segment**
of the resolved source, which is what makes `{{reasons.code}}` mean *this element's* reason
rather than a list across the event.

Two consequences worth stating up front:

1. **`leafFields()` hides containers today** (`IntegrationEventBindingService.fieldsOf`), which
   is precisely why there is nowhere to express the collection. This adds the missing
   affordance rather than inventing a mechanism.
2. **The drawer stops needing the server to tell it the roots.** `contextRoot` and
   `templateRoots` were added so the UI could learn what only the schema knew. Once the
   operator declares the collection, the UI holds that knowledge in its own draft mapping and
   can derive both client-side. Those two DTO fields become back-compat only, and this plan
   deprecates them rather than maintaining a second source of truth.

## Phases

Independent; each ships on its own and leaves the system working.

### P1 — renderer prefers the binding (backend only, no behaviour change) — **DONE**

Implemented as described below. Settled while building it:

- **Collection-row syntax is `{{path}}`** — one syntax across every row, and a bare root
  (`{{content}}`) is legal on a collection row where a value row still refuses it as a whole
  object. Reversible: nothing authors these through the UI yet.
- **A top-level array *body* still reads `schema.itemsFrom()`.** It has no field name, so no
  dotted key to bind a row to; deciding that key is P2's problem. Array *fields* — the shape in
  use — are covered.
- **`leaves()`/`fieldsOf` remain schema-only**, so a pure contract bound only through collection
  rows would still hint the wrong `contextRoot`. Unreachable today (the drawer cannot author
  collection rows), and P2 threads the binding through.

- `PayloadRenderer.renderObject`, `ARRAY` branch: resolve the source as
  **binding template for the container path → schema `itemsFrom` → `content`**, instead of
  `field.itemsFrom()` alone. One helper, `collectionSourceOf(templates, path, field)`.
- `PayloadRenderer.validate`:
  - a container row is **optional** (a default exists), so the required-leaf check must not
    start demanding one;
  - a container row's template is **not** a scalar template. `PayloadTemplate.validate`
    rejects `{{content}}` as `wholeObject`, which is correct for a value and wrong for a
    collection — collection rows need their own rule: a single stash, a dotted or bare root
    path, no helpers.
- Roots: `arrayBindNames()` becomes a function of *(schema, field_templates)* rather than the
  schema alone, since the source may now come from the binding.
- Tests: a binding-declared source wins over the schema's; a schema-only contract still
  renders identically (the regression guard for every stored config).

Nothing is authorable through the UI yet — this phase only makes the binding *authoritative
when present*.

### P2 — feed and drawer — **DONE**

Settled while building it:

- **A collection row is never `required`.** Leaving its source unmapped falls back to the
  contract's, so demanding one would block a save for nothing —
  `unmappedRequiredFields` skips them and `PayloadSchema.Row.required` is false for them.
- **The drawer prefers its own draft over the server's `contextRoot`.** `scopeOfRow` finds the
  innermost enclosing collection row and reads its bind name from the draft mapping, so naming a
  collection re-scopes the rows under it immediately, without a round trip.
- **Unknown roots stay unknown.** When a modulith reports no `templateRoots`, adding only the
  roots the draft happens to declare would look authoritative while still rejecting whatever the
  contract introduces — `contractRoots` returns null and the unknown-root rule is skipped.
- **A top-level array body still reads `schema.itemsFrom()`** — decided, not deferred again: it
  has no field name, so binding a row to it means inventing a key (`""`, `"[]"`) and a label for
  a shape nothing in use has. `itemsFrom` stays meaningful for that one case, so P3's "drop the
  fallback" is really "drop it for array *fields*".
- **`contextRoot` on a collection row means the scope it sits *in*, not the one it creates.**
  Two different questions, and conflating them is a live bug source: the row's own template is
  validated against the *enclosing* scope, while the echo beneath it needs this collection's own
  default source. They coincide only because everything defaults to `content`, so the confusion
  hides on nested arrays and shows on a top-level one, which sits in no scope at all. The drawer
  derives the echo's value client-side (`collectionFallbackRoot`, off a value row the collection
  scopes) rather than adding a second DTO field that P3 would only have to remove.


- `DispatchTargetResponse.Field` gains a kind (`value` | `collection`); `fieldsOf` stops
  filtering containers out.
- Drawer: render a collection row with its own affordance and validation rule (pick a
  collection, not a scalar), and derive each value row's `contextRoot` plus the accepted roots
  from the **draft mapping**, falling back to the server's fields while older moduliths are
  deployed.
- Required-field summary and the save gate must treat a collection row as satisfied by its
  default, or the drawer will block on rows that need no mapping.

### P3 — deprecate the schema's copy

- Migration: for stored bindings whose operation schema carries `itemsFrom`, write the
  equivalent container rows into `field_templates`. Idempotent, and leaves the schema
  untouched so a rollback still renders.
- Then drop the schema fallback, stop parsing `itemsFrom`, and remove `contextRoot` /
  `templateRoots` from the DTO.
- New templates are authored as pure JSON Schema; a pasted partner schema is complete.

## Decisions to confirm before P1

- **Collection row syntax** — `{{content.reasons}}` (consistent with every other row, needs
  the collection-specific validation rule) or a bare `content.reasons` (unambiguous, but a
  second syntax in the same map).
- **An unmapped array** — keep defaulting to `content` indefinitely, or make it an explicit
  error in P3 once every binding has been migrated.
- **Whether P3 migrates stored bindings** or the schema fallback simply stays forever. Keeping
  it is cheaper; removing it is what actually restores the separation.

## Note

This plan makes the previously-considered "warn when a nested array omits `itemsFrom`" guard
in the template form unnecessary: once the contract carries no `itemsFrom`, there is nothing
to omit. Do not build both.
