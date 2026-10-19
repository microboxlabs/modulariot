---
name: selectables
description: >
  Read and edit the organization's option lists — the choices behind form
  fields such as delay reasons, regions or vehicle types — and which field
  uses which list.
when_to_use: >
  The user asks what options a field or list has, looks up an option, or
  wants to create, change or delete a list, add or rename options, or point
  a form field at another list.
mcp:
  url: ${MIOT_HARNESS_MODULITH_URL}/api/v1/mcp
  tools: [selectables_*]
---

# Option lists

An organization's forms take their choices from option lists. Each list has
a `key` (e.g. `delay_reason`), a name per language, a mode (`SINGLE` or
`MULTIPLE`) and either its own options (a static list) or a source it reads
them from (`SYSTEM` or `CONNECTION`). A form field uses the list whose key
equals the field key unless a binding points it at another one.

## Reading

- Start with `selectables_list` to see the lists, or `selectables_get` when
  you know the key.
- For the options a field shows, use `selectables_options`; it also works for
  lists that read from a source. Use `search` to find an option by value or
  label, and `parents` when the list depends on another one.
- `selectables_bindings` says which list each field uses.

## Changing

- Changes need an organization owner; if the server refuses, say so and stop.
- `selectables_replace` replaces the whole list. Read it first with
  `selectables_get`, change what the user asked for, and send the rest back
  unchanged.
- Never change the `value` of an existing option: records store it. Change
  its label instead. New options may leave `value` out; one is made from the
  label.
- A `SYSTEM` or `CONNECTION` list takes its options from its source: send no
  options for it. `selectables_sources` lists the sources you can use.
- A list other lists depend on cannot be deleted until they stop depending
  on it.

## Answering

Name lists and options by their label in the user's language, with the key
or value in parentheses when it helps. After a change, say what changed.
