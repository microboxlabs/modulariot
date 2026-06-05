# Harness dispatch modes (`auto` | `canned` | `meta` | `agentic`)

The dispatch mode is set per run via `RunRequest.mode` (REST `POST /runs:start`)
and surfaced in `miot-chat` as `--mode`, `MIOT_CHAT_MODE`, and the `/mode` slash
command. It decides which graph/agent the `HarnessSupervisor` invokes.

Sources of truth:

- `miot-harness/src/miot_harness/runtime/context.py` — `RunMode` literal type.
- `miot-harness/src/miot_harness/runtime/mode_resolver.py` — `resolve_mode()` +
  `_EXPLICIT_MODE_ROUTES`.
- `miot-harness/src/miot_harness/runtime/router.py` — `HarnessRoute` enum and
  the keyword router used by `auto`.
- `miot-harness/src/miot_harness/runtime/supervisor.py` — dispatch in
  `HarnessSupervisor.run()` (`_run_data_query` / `_run_data_meta` /
  `_run_data_agentic`).

## `auto` — let the harness pick

- **What it does:** runs the LLM intent router if injected, else the keyword
  router (`IntentRouter`). The router returns one of `DATA_QUERY`,
  `DATA_META`, `DATA_AGENTIC`, `STORYTELLING_RUN`, `DIRECT`, or `OTHER`.
- **When to use:** day-to-day chat. You don't know — or don't care — which
  path is appropriate.
- **Example questions:**
  - "What's in stock at Mintral right now?" → routes to canned.
  - "How does `fn_dx_cola_critica` work?" → routes to meta.
  - "Hi, what can you do?" → routes to direct.

## `canned` — `DATA_QUERY` → data graph

- **What it does:** dispatches directly to the curated data graph
  (`runtime/data_graph.py`), which invokes the datasource's curated analytical
  functions (for **nexo**: the `fn_dx_*` Coordinador functions). Deterministic
  SQL, real data, tenant-gated.
- **Tenant rule:** data-touching, gated by `tenant_lock` (the datasource
  profile's default; `mintral` for nexo). The mode itself isn't refused at
  validation, but the underlying tools enforce the tenant lock.
- **When to use:** you know the answer lives in a curated analytical function
  and you want to skip the router.
- **Example questions:**
  - "ETA del próximo despacho a la Torre de Control."
  - "Estado actual de la cola crítica."
  - "Resumen del dimensionamiento de hoy."
  - "Auditoría POD de la última hora."

## `meta` — `DATA_META` → `meta_agent_node`

- **What it does:** answers from the **cached catalog + the active datasource's
  primer text** (for **nexo**: the `pg_proc` catalog + Coordinador primer). No
  SQL, no tool invocation, no data access — pure schema/introspection.
- **Tenant rule:** allowed for **any tenant** — meta-info is non-confidential
  per the plan's tenant-gate decision.
- **When to use:** "what does this function do / what's in the catalog /
  explain the domain."
- **Example questions:**
  - "What `fn_dx_*` functions exist and what does each one return?"
  - "Explain what 'Coordinador' means in this system."
  - "Which function should I use to look up a POD audit?"
  - "Describe the inputs and outputs of `fn_dx_cola_critica`."

## `agentic` — `DATA_AGENTIC` → `agentic_graph`

- **What it does:** planner Sonnet + **composable primitives** for open-ended
  exploration. Turn cap is 12 (vs 8 in `canned`), critic is ON by default.
- **Tenant rule:** **locked-tenant-only** (the datasource's `tenant_lock`;
  `mintral` for nexo). `resolve_mode()` raises `ModeAccessDenied` at
  request-validation time for any off-lock tenant; the supervisor records a
  `mode_access_denied` answer and emits `answer.completed`. The `miot-chat` TUI
  header bar warns in yellow if you set `mode=agentic` on an off-lock tenant.
- **When to use:** multi-step exploration where no single canned function
  answers the question — combine primitives, hypothesize, iterate.
- **Example questions:**
  - "Compare ETA accuracy over the last 3 weeks and flag the worst route."
  - "Why did the critical queue spike yesterday? Walk through your reasoning."
  - "Find anomalies in POD audits and propose a hypothesis."
  - "What patterns predict a late dispatch?"

## Quick comparison

| Mode      | Route          | Backend            | SQL?       | Tenant gate     | Best for                          |
|-----------|----------------|--------------------|------------|-----------------|-----------------------------------|
| `auto`    | router-decided | any                | maybe      | inherits route  | normal use                        |
| `canned`  | `DATA_QUERY`   | data graph         | yes, curated | locked-tenant-only* | known operational questions   |
| `meta`    | `DATA_META`    | `meta_agent_node`  | **no**     | any tenant      | schema, primer, "how does X work" |
| `agentic` | `DATA_AGENTIC` | `agentic_graph`    | yes, via primitives | **locked-tenant-only** (rejected at validation) | exploratory analysis |

\* `canned` data access is enforced inside the tools via `tenant_lock`; the
mode itself is not rejected by `resolve_mode()`.

## Rule of thumb

Stay on `auto` unless:

- You want to **force `meta`** for a schema question to skip any chance of
  the router picking SQL.
- You want to **force `canned`** when you already know which curated function
  has the answer (saves a router turn).
- You want **`agentic`** on `mintral` for genuine exploration that doesn't
  map to a single canned function.
