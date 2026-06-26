---
id: alfresco-activiti
title: Alfresco / Activiti workflow
fingerprint: [act_ru_task, act_re_procdef, act_hi_procinst]
version_probe:
  sql: "SELECT value_ FROM act_ge_property WHERE name_ = 'schema.version'"
  label: Activiti schema.version
---

This schema embeds the **Activiti** BPM engine (the `act_*` tables) and, when
`alf_*` tables are present, the **Alfresco** content repository. Table families:

- `act_ru_*` — runtime (in-flight) state: `act_ru_task` (open user tasks),
  `act_ru_execution` (running process instances/branches), `act_ru_variable`
  (process/task variables), `act_ru_identitylink` (task assignees/candidates).
- `act_hi_*` — history (completed): `act_hi_procinst`, `act_hi_taskinst`,
  `act_hi_actinst`, `act_hi_varinst`, `act_hi_detail`.
- `act_re_*` — repository (definitions): `act_re_procdef`, `act_re_deployment`.
- `act_id_*` — identity (users/groups). `act_ge_*` — general (`act_ge_property`
  holds the engine `schema.version`).

Prefer the connection's `query` tool for anything spanning more than one table.

## card: workflow-business-data · Read a task's/process's business attributes

**Business data lives in process VARIABLES, not in columns.** `act_ru_task` and
`act_ru_execution` hold engine bookkeeping (ids, dates, assignee, priority) — the
domain attributes of the thing the workflow is about (codes, names, references)
are rows in **`act_ru_variable`**, one row per variable:
`name_` = variable name, value in `text_` / `long_` / `double_` / `bytearray_id_`.

`act_ru_execution.business_key_` is often **empty**; do not rely on it — read the
variables instead. To attach variables to a task, join on the process instance:

```
act_ru_task t  JOIN  act_ru_variable v  ON  v.proc_inst_id_ = t.proc_inst_id_
```

Steps to answer "give me the <things> in step X with their attributes":
1. Discover which variables exist:
   `SELECT DISTINCT name_ FROM <schema>.act_ru_variable ORDER BY name_` (often
   namespaced, e.g. `<app>_<attribute>`).
2. Pivot the ones you need with conditional aggregation:
   `max(CASE WHEN v.name_ = '<varname>' THEN v.text_ END) AS <alias>`,
   `GROUP BY t.proc_inst_id_`.
3. Filter the task by its step (see the next card).

**Finish the job:** once you know the relevant variable names, run the pivot
`query` and return the actual business attributes (codes, names, references) as
the answer — one row per item. Do NOT stop at the engine ids / task descriptions
or offer to query further; the engine ids are not the answer the user wants.

## card: tasks-by-step · Find tasks currently in a workflow step

A workflow "step" is an open task in `act_ru_task`. Identify a step by:
- `task_def_key_` — the stable BPMN task id (e.g. a camelCase key), best for
  filtering; or
- `name_` — the human label shown to users (may be localized).

Open/unassigned tasks have `assignee_` IS NULL. `suspension_state_ = 1` means
active (2 = suspended). `act_ru_task` is runtime only — completed tasks move to
`act_hi_taskinst`. To list a step's items with business attributes, filter
`act_ru_task` by the step, then apply the variable-pivot from the
`workflow-business-data` card.
