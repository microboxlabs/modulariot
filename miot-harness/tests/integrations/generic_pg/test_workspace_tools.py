"""`<conn>_memory` and `<conn>_analysis` keep what the agent learns per tenant,
and `<conn>_show` can render a saved analysis."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from miot_harness.datasource.safe_sql import MutationRejected
from miot_harness.datasource.sql_policy import SchemaAllowlistPolicy
from miot_harness.integrations.generic_pg.primitive_tools import build_generic_tools
from miot_harness.runtime.context import HarnessContext
from tests.fixtures.recording_pool import RecordingPool

OPS = SchemaAllowlistPolicy(frozenset({"ops"}))


def _pool() -> RecordingPool:
    def respond(sql: str) -> list[dict[str, Any]]:
        if sql.startswith("EXPLAIN"):
            return [{"QUERY PLAN": [{"Plan": {"Total Cost": 1.0}}]}]
        return [{"carrier": "A", "n": 3}]

    return RecordingPool(responder=respond)


def _tools(pool: RecordingPool, workspace: Path | None) -> dict[str, Any]:
    tools = build_generic_tools(
        pool=pool,
        policy=OPS,
        tool_prefix="fleet_",
        source_label="fleet",
        tenant_lock=None,
        max_rows=100,
        explain_cost_threshold=1e6,
        statement_timeout_ms=5000,
        workspace_dir=workspace,
    )
    return {t.name: t for t in tools}


def _ctx(tenant: str = "acme") -> HarnessContext:
    return HarnessContext(
        thread_id="t", tenant_id=tenant, user_id="ana@example.com", conversation_id="c1"
    )


async def _call(tool: Any, ctx: HarnessContext, **args: Any) -> Any:
    return await tool.call(ctx, tool.input_model(**args), lambda e: None)


def test_no_workspace_means_no_memory_or_analysis_tools() -> None:
    names = set(_tools(_pool(), None))
    assert "fleet_memory" not in names and "fleet_analysis" not in names


@pytest.mark.asyncio
async def test_a_confirmed_definition_is_there_in_the_next_conversation(tmp_path: Path) -> None:
    memory = _tools(_pool(), tmp_path)["fleet_memory"]
    assert memory.read_only is False
    await _call(
        memory,
        _ctx(),
        action="write",
        title="Driving time",
        kind="definition",
        body="minutes_moving / 60",
    )
    listed = await _call(memory, _ctx(), action="list")
    assert listed.notes == [{"id": "driving-time", "title": "Driving time", "kind": "definition"}]
    assert (await _call(memory, _ctx("other"), action="list")).notes == []


@pytest.mark.asyncio
async def test_save_tests_the_query_then_run_and_show_reuse_it(tmp_path: Path) -> None:
    pool = _pool()
    tools = _tools(pool, tmp_path)
    saved = await _call(
        tools["fleet_analysis"],
        _ctx(),
        action="save",
        name="trips by carrier",
        description="Trips per carrier",
        sql="SELECT carrier, count(*) AS n FROM ops.trips WHERE year = :year GROUP BY 1",
        params=[{"name": "year", "type": "int", "default": 2026}],
    )
    assert saved.analysis["name"] == "trips_by_carrier"
    assert saved.analysis["columns"] == ["carrier", "n"]
    assert any("year = 2026" in sql for sql, _ in pool.conn.fetched)

    ran = await _call(
        tools["fleet_analysis"], _ctx(), action="run", name="trips_by_carrier", args={"year": 2025}
    )
    assert "year = 2025" in (ran.executed_sql or "")

    shown = await _call(
        tools["fleet_show"],
        _ctx(),
        analysis="trips_by_carrier",
        widget="bar",
        title="T",
        x="carrier",
        y=["n"],
    )
    assert shown.row_count == 1


@pytest.mark.asyncio
async def test_a_query_that_fails_is_not_saved(tmp_path: Path) -> None:
    tools = _tools(_pool(), tmp_path)
    with pytest.raises(MutationRejected):
        await _call(
            tools["fleet_analysis"],
            _ctx(),
            action="save",
            name="bad",
            sql="DELETE FROM ops.trips",
            params=[],
        )
    assert (await _call(tools["fleet_analysis"], _ctx(), action="list")).analyses == []
