"""`<conn>_show` sends the full result to the user as a widget event and gives
the model only a preview."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

import pytest

from miot_harness.datasource.sql_policy import SchemaAllowlistPolicy
from miot_harness.integrations.generic_pg.primitive_tools import build_generic_tools
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from tests.fixtures.recording_pool import RecordingPool

OPS = SchemaAllowlistPolicy(frozenset({"ops"}))
ROWS = [{"carrier": f"C{i}", "hours": Decimal(f"{100 + i}.5")} for i in range(12)]


def _show_tool(pool: RecordingPool) -> Any:
    tools = build_generic_tools(
        pool=pool,
        policy=OPS,
        tool_prefix="fleet_",
        source_label="fleet",
        tenant_lock=None,
        max_rows=1000,
        explain_cost_threshold=1e6,
        statement_timeout_ms=5000,
    )
    return next(t for t in tools if t.name == "fleet_show")


def _pool(rows: list[dict[str, Any]]) -> RecordingPool:
    def respond(sql: str) -> list[dict[str, Any]]:
        if sql.startswith("EXPLAIN"):
            return [{"QUERY PLAN": [{"Plan": {"Total Cost": 10.0, "Node Type": "Seq Scan"}}]}]
        return rows

    return RecordingPool(responder=respond)


async def _show(rows: list[dict[str, Any]], **args: Any) -> tuple[Any, list[HarnessEvent]]:
    events: list[HarnessEvent] = []
    tool = _show_tool(_pool(rows))
    ctx = HarnessContext(thread_id="t", tenant_id="t", user_id="u")
    params = {"sql": "SELECT carrier, hours FROM ops.trips", "title": "Horas", **args}
    out = await tool.call(ctx, tool.input_model(**params), events.append)
    return out, events


@pytest.mark.asyncio
async def test_the_user_gets_every_row_and_the_model_a_preview() -> None:
    out, events = await _show(ROWS, widget="bar", x="carrier", y=["hours"], unit="h")
    [event] = events
    widget = event.data["widget"]
    assert event.type == "widget.created"
    assert widget["id"] == out.widget_id
    assert (widget["kind"], widget["x"], widget["y"], widget["unit"]) == (
        "bar",
        "carrier",
        ["hours"],
        "h",
    )
    assert len(widget["rows"]) == 12
    assert widget["rows"][0] == {"carrier": "C0", "hours": "100.5"}
    assert len(out.preview) == 5
    assert out.row_count == 12
    assert out.widget_id in out.note


@pytest.mark.asyncio
async def test_a_chart_naming_a_missing_column_is_refused() -> None:
    with pytest.raises(ValueError, match="'trips' is not in the result"):
        await _show(ROWS, widget="line", x="month", y=["trips"])


@pytest.mark.asyncio
async def test_a_chart_needs_both_axes() -> None:
    with pytest.raises(ValueError, match="needs x and at least one y"):
        await _show(ROWS, widget="pie", y=["hours"])


@pytest.mark.asyncio
async def test_a_table_needs_no_axes() -> None:
    out, events = await _show(ROWS, widget="table")
    assert events[0].data["widget"]["columns"] == ["carrier", "hours"]
    assert out.row_count == 12


@pytest.mark.asyncio
async def test_an_empty_result_is_refused_for_charts_but_not_tables() -> None:
    with pytest.raises(ValueError, match="no rows"):
        await _show([], widget="kpi", y=["hours"])
    out, events = await _show([], widget="table")
    assert out.row_count == 0
    assert events[0].data["widget"]["rows"] == []


@pytest.mark.asyncio
async def test_a_capped_result_is_reported_as_partial() -> None:
    many = [{"carrier": f"C{i}", "hours": i} for i in range(500)]
    out, events = await _show(many, widget="table")
    assert events[0].data["widget"]["truncated"] is True
    assert "cut at 500 rows" in out.note
