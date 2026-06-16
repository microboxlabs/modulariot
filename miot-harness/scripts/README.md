# Operational scripts

Run everything from the `miot-harness/` directory with `uv run`.

## `smoke_auth_e2e.py`

Tier-1 harness-only auth e2e smoke (real uvicorn + RS256 + SSE, no
external dependencies):

```sh
uv run python scripts/smoke_auth_e2e.py
```

## `diagnose_task_timeline.py`

Read-only diagnostic for the Gap-3 beta finding (`coordinador_task_timeline`
returning 0 rows for a valid service code). Probes function signatures,
calls `fn_dx_task_timeline` by `p_service_code` and `p_proc_inst_id`,
and — if both come back empty — checks the underlying `dx_*` snapshot
tables to distinguish a filter-semantics bug from an unrefreshed snapshot
(the latter is a DB-side escalation).

Requires `MIOT_HARNESS_DATASOURCE_DSN` (env or `.env`):

```sh
uv run python scripts/diagnose_task_timeline.py --service-code 1643006
uv run python scripts/diagnose_task_timeline.py --service-code 1643006 --proc-inst-id 45703329
```

Diagnosis run on 2026-06-11 against tenant mintral concluded:
`p_service_code` works (11 rows, fresh snapshot) — the beta failure was
an unrefreshed snapshot that day, not argument semantics. Note that all
`p_*` filters are pg `text`; the harness now coerces numeric LLM args
to strings (see `tool_factory._input_model_from_args`).
