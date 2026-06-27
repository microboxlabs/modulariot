---
id: alfresco-activiti
title: Alfresco / Activiti workflow
fingerprint: [act_ru_task, act_re_procdef, act_hi_procinst]
version_probe:
  sql: "SELECT value_ FROM act_ge_property WHERE name_ = 'schema.version'"
  label: Activiti schema.version
---

This schema embeds the **Activiti** BPM engine (the `act_*` tables) and, when
`alf_*` tables are present, the **Alfresco** content repository. Both sides store
business data in an **entity-attribute-value (EAV)** shape — values live in
"properties"/"variables" rows, not in wide columns — so almost every real query
joins a core entity to its attribute rows. Table families:

- `act_ru_*` runtime, `act_hi_*` history, `act_re_*` repository, `act_id_*`
  identity, `act_ge_*` general (`act_ge_property` holds the engine
  `schema.version`).
- `alf_node` (every content object) + `alf_node_properties` (its metadata),
  `alf_qname`/`alf_namespace` (property/type names), `alf_content_data`/
  `alf_content_url` (the binary), `alf_child_assoc` (folder hierarchy),
  `alf_store` (workspace/archive/version stores), `alf_acl_*`/`alf_authority`/
  `alf_permission` (permissions).

Prefer the connection's `query` tool for anything spanning more than one table.
**Never hardcode numeric ids** (`store_id`, `type_qname_id`, `qname_id`) — they
differ per instance; always join `alf_qname`/`alf_namespace`/`alf_store` by their
text columns (`local_name`, `uri`, `protocol`).

## card: workflow-business-data · Read a task's/process's business attributes

**Business data lives in process VARIABLES, not in columns.** `act_ru_task` and
`act_ru_execution` hold engine bookkeeping (ids, dates, assignee, priority) — the
domain attributes of the thing the workflow is about (codes, names, references)
are rows in **`act_ru_variable`**, one per variable: `name_` = variable name,
value in `text_` / `long_` / `double_` / `bytearray_id_`.

`act_ru_execution.business_key_` is often **empty**; do not rely on it — read the
variables instead. Attach variables to a task via the process instance:

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
3. Filter the task by its step (see the `tasks-by-step` card).

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
`act_ru_task` by the step, then apply the variable-pivot from
`workflow-business-data`.

## card: alfresco-content-model · Read Alfresco node metadata & files (alf_*)

Alfresco uses the SAME EAV idea as Activiti. `alf_node` is one row per object
(document, folder, user, group, site …); its metadata is rows in
**`alf_node_properties`**, keyed by `qname_id` → `alf_qname (local_name, ns_id)`
→ `alf_namespace (uri)`. The value is in `string_value` / `long_value` /
`boolean_value` by datatype.

Canonical skeletons (join names by text, never by numeric id):

```
-- a node's type and a named property (e.g. cm:name)
alf_node n
JOIN alf_qname tq            ON tq.id = n.type_qname_id            -- node type
JOIN alf_node_properties p   ON p.node_id = n.id
JOIN alf_qname pq            ON pq.id = p.qname_id AND pq.local_name = 'name'
```

To pivot several properties for one node, aggregate like the workflow card:
`max(CASE WHEN pq.local_name = '<prop>' THEN p.string_value END) AS <alias>` with
`GROUP BY n.id`. Discover available properties with
`SELECT DISTINCT local_name FROM <schema>.alf_qname ORDER BY local_name`.

A document's **binary** is itself a property: the `content` property's
`long_value` points at `alf_content_data.id`, which references
`alf_content_url (content_size, content_url, orphan_time)`:

```
alf_node_properties pc  ... pq.local_name = 'content'
JOIN alf_content_data d  ON d.id = pc.long_value
JOIN alf_content_url u   ON u.id = d.content_url_id        -- size_bytes = u.content_size
```

Count objects by type via `alf_node n JOIN alf_qname q ON q.id = n.type_qname_id
WHERE q.local_name = 'content' | 'folder' | 'person' | 'authorityContainer' | …`.

## card: alfresco-paths-and-stores · Folder hierarchy, paths, and stores

**Hierarchy** is `alf_child_assoc (parent_node_id, child_node_id,
qname_localname)`. It is flat parent→child; walk it with a recursive CTE to build
a path or count descendants:

```
WITH RECURSIVE up AS (
  SELECT child_node_id, parent_node_id, qname_localname
  FROM <schema>.alf_child_assoc WHERE child_node_id = :node
  UNION ALL
  SELECT a.child_node_id, a.parent_node_id, a.qname_localname
  FROM <schema>.alf_child_assoc a JOIN up ON a.child_node_id = up.parent_node_id
)
SELECT string_agg(qname_localname, ' > ') FROM up;   -- full path to root
```

**Stores** distinguish live vs. deleted vs. versioned content — join `alf_store`
by its text columns, never the numeric `store_id`:
- `workspace://SpacesStore` — current/live nodes.
- `archive://SpacesStore` — deleted (in the trashcan).
- `workspace://version2Store` — version history.

`SELECT s.protocol, s.identifier FROM alf_store s WHERE s.id = n.store_id`.
Fully purged content shows `alf_content_url.orphan_time IS NOT NULL`. A node ref
is `protocol://identifier/uuid` (`alf_node.uuid`).
