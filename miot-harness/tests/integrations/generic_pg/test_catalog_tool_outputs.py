"""The catalog tools must produce evidence the agent loop can count: rows under
`rows`, the pre-limit match count under `total`, and compact rows."""

from __future__ import annotations

import pytest

from miot_harness.agents.data_fetcher import _evidence_from_output
from miot_harness.datasource.sql_policy import SchemaAllowlistPolicy
from miot_harness.integrations.generic_pg.primitive_tools import build_generic_tools
from miot_harness.runtime.context import HarnessContext
from tests.fixtures.recording_pool import RecordingPool

PUBLIC = SchemaAllowlistPolicy(frozenset({"public"}))

_ROUTINE_ROW = {
    "schema": "public",
    "name": "api_modular_symptoms_dashboard",
    "args": "p_client_id character varying DEFAULT NULL::character varying",
    "returns": "jsonb",
    "kind": "f",
    "volatility": "v",
    "language": "plpgsql",
    "description": "Dashboard de síntomas\n\nLong body line two\nline three",
    "total": 58,
}


def _tool(pool, name: str):
    tools = build_generic_tools(
        pool=pool,
        policy=PUBLIC,
        tool_prefix="gps_",
        source_label="gps",
        tenant_lock=None,
        max_rows=100,
        explain_cost_threshold=1e6,
        statement_timeout_ms=5000,
    )
    return next(t for t in tools if t.name == name)


@pytest.mark.asyncio
async def test_functions_output_counts_as_rows_with_total() -> None:
    pool = RecordingPool(fetch_return=[_ROUTINE_ROW])
    tool = _tool(pool, "gps_functions")
    ctx = HarnessContext(thread_id="t", tenant_id="t", user_id="u")
    out = await tool.call(ctx, tool.input_model(pattern="%symptom%", limit=5), lambda e: None)
    dump = out.model_dump()
    assert dump["total"] == 58
    assert dump["rows"][0]["name"] == "public.api_modular_symptoms_dashboard"
    assert dump["rows"][0]["summary"] == "Dashboard de síntomas"
    assert "description" not in dump["rows"][0]
    ev = _evidence_from_output(
        "s1", "gps_functions", dump, warn_minutes=0, source_label="gps", has_freshness_model=False
    )
    assert ev.sample_size == 1 and ev.freshness_status == "fresh"


@pytest.mark.asyncio
async def test_definition_output_counts_as_rows() -> None:
    def respond(sql: str) -> list:
        if "pg_get_viewdef" in sql:
            return [{"relkind": "v", "definition": "SELECT 1", "description": None}]
        return []

    pool = RecordingPool(responder=respond)
    tool = _tool(pool, "gps_definition")
    ctx = HarnessContext(thread_id="t", tenant_id="t", user_id="u")
    out = await tool.call(ctx, tool.input_model(name="public.v_x"), lambda e: None)
    dump = out.model_dump()
    assert dump["rows"] == [
        {
            "name": "public.v_x",
            "kind": "view",
            "definition": "SELECT 1",
            "description": "",
            "truncated": False,
        }
    ]
    ev = _evidence_from_output(
        "s1", "gps_definition", dump, warn_minutes=0, source_label="gps", has_freshness_model=False
    )
    assert ev.sample_size == 1
