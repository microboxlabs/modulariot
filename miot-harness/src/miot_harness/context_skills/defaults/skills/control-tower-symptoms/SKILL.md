---
name: control-tower-symptoms
description: >
  Read the Control Tower symptom catalog — what each symptom (síntoma)
  detects, its levels and thresholds, its versions — and propose changes
  to its rules as a draft for the owner to publish.
when_to_use: >
  The user asks what a symptom detects, at which values each level
  (Bajo observación, Comprometida, Crítica, Código negro) fires, why a case
  fired or reached a level, what changed between versions, or wants to
  raise or lower a threshold, change a response, roll back or turn a
  symptom on or off.
mcp:
  url: ${MIOT_HARNESS_MODULITH_URL}/api/v1/mcp
  tools:
    - symptoms_list
    - symptoms_get
    - symptoms_sources
    - symptoms_validate
    - symptoms_preview
    - symptoms_plan_publish
    - symptoms_save_draft
    - symptoms_publish
    - symptoms_rollback
    - symptoms_set_state
---

# Control Tower symptoms

A symptom is a rule that opens a case when a vehicle's data shows a
problem, such as speeding. Its rules are a spec with versions. The spec
has:

| Part | What it is |
| --- | --- |
| `source` | The data source the rules read, e.g. `gps_signal`. |
| `activation` | CEL over the source: which situations are candidates. |
| `measure.expression` | CEL over the source: the number that sets the level. |
| `levels` | ICU 1 to 4. Each `when` is CEL over `medida` and `sostenido_s` (seconds held), plus a `response`. |
| `lifecycle` | `open` and `close`, CEL over `caso`. |

A symptom is `OFF` (not evaluated), `TEST` ("En prueba", not sent to
operators) or `ACTIVE`.

## Answering questions

- Find the symptom with `symptoms_list`, then read it with `symptoms_get`.
  Explain its rules from the version in force, not from the draft.
- For "why did this case fire", compare the case's values with
  `activation`, the `measure` and each level's `when`. The case gets the
  highest level whose `when` is true.
- Field names and units are in `symptoms_sources` with the source key.
- Explain rules in plain words with their numbers, e.g. "Crítica when the
  speed is 11 to 20 km/h over the limit". Show CEL only when asked.

## Proposing a change

1. Read the symptom with `symptoms_get`. Change only what the user asked
   for and keep the rest of the spec as it is.
2. Run `symptoms_validate` with the new spec. Fix every `ERROR`.
3. Run `symptoms_preview` to show what the change does on the samples.
4. Save it with `symptoms_save_draft`. This needs an organization owner.
   If the server refuses, show the proposed change and stop.
5. Run `symptoms_plan_publish` and tell the owner the changes, the bump
   and the next version.

The bump is computed:

| Bump | When |
| --- | --- |
| MAJOR | `source`, `activation` or the measure expression changed. |
| MINOR | A threshold, a level turned on or off, the lifecycle or the recurrence changed. |
| PATCH | Only responses, or the measure's label or unit, changed. |

## Rules

- Never call `symptoms_publish`, `symptoms_rollback` or
  `symptoms_set_state` until the owner has seen the plan and explicitly
  said to go ahead.
- Always validate and plan before asking to publish.
- Publishing needs a reason. Ask the owner for it and use their words.
- Publish as `TEST` unless the owner asks for `ACTIVE`.
- A finding in section `engine` means the version can only run as `TEST`.
  Say so.
