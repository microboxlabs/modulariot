"""`<conn>_workflow`: registered only where the BPMN engine tables are visible;
list/graph/stats run gated SQL and the graph reaches the user as an artifact."""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

import pytest

from miot_harness.config import HarnessSettings
from miot_harness.connections.models import Connection
from miot_harness.datasource.schema_introspect import SchemaSummary, TableInfo
from miot_harness.datasource.sql_policy import SchemaAllowlistPolicy
from miot_harness.integrations.generic_pg.primitive_tools import build_generic_tools
from miot_harness.integrations.generic_pg.provider import GenericPgProvider, workflow_schema
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.tools.registry import ToolRegistry
from tests.fixtures.recording_pool import RecordingPool

FIXTURE = Path(__file__).parents[2] / "fixtures" / "bpmn" / "request_review.bpmn20.xml"
DEF = {
    "id_": "requestReview:3:77",
    "key_": "requestReview",
    "name_": "Request review",
    "version_": 3,
    "deployment_id_": "70",
    "resource_name_": "request_review.bpmn20.xml",
}
CTX = HarnessContext(thread_id="t", tenant_id="t", user_id="u")


def _tools(pool: Any, schema: str | None = "wf", cost: float = 1e6) -> list[Any]:
    return build_generic_tools(
        pool=pool,
        policy=SchemaAllowlistPolicy(frozenset({"wf"})),
        tool_prefix="ops_",
        source_label="ops",
        tenant_lock=None,
        max_rows=1000,
        explain_cost_threshold=cost,
        statement_timeout_ms=5000,
        workflow_schema=schema,
    )


def _responder(*, xml: bytes | None = None, expensive: str | None = None) -> Any:
    def respond(sql: str) -> list[dict[str, Any]]:
        if sql.startswith("EXPLAIN"):
            cost = 1e9 if expensive and expensive in sql else 10.0
            return [{"QUERY PLAN": [{"Plan": {"Total Cost": cost, "Node Type": "Seq Scan"}}]}]
        if "act_ge_bytearray" in sql:
            return [{"bytes_": xml if xml is not None else FIXTURE.read_bytes()}]
        if "act_hi_procinst" in sql:
            return [
                {"proc_def_id_": "requestReview:3:77", "total": 40, "running": 4},
                {"proc_def_id_": "requestReview:2:50", "total": 60, "running": 1},
            ]
        if "PERCENTILE_CONT" in sql:
            return [
                {"task": "ship", "name": "Prepare shipment", "started": 30, "completed": 28,
                 "median_ms": 2 * 86_400_000.0, "p90_ms": 5 * 86_400_000.0},
                {"task": "register", "name": None, "started": 55, "completed": 55,
                 "median_ms": 600_000.0, "p90_ms": 3_600_000.0},
            ]  # fmt: skip
        if "act_ru_task" in sql:
            return [{"task_def_key_": "ship", "open": 2}]
        if "LAG(" in sql:
            return [
                {"from_id": "register", "to_id": "decide", "n": 55},
                {"from_id": "revise", "to_id": "register", "n": 15},
                {"from_id": "ship", "to_id": "notify", "n": 3},
            ]
        if "HAVING" in sql:
            return [{"task": "register", "instances": 12, "repeats": 15}]
        if "act_re_procdef" in sql and "deployment_id_" in sql:
            return [DEF]
        if "act_re_procdef" in sql:
            return [
                {"key_": "requestReview", "name_": "Request review", "version_": 3,
                 "id_": "requestReview:3:77"},
                {"key_": "requestReview", "name_": "Request review", "version_": 2,
                 "id_": "requestReview:2:50"},
                {"key_": "other", "name_": "Other", "version_": 1, "id_": "other:1:9"},
            ]  # fmt: skip
        return []

    return respond


async def _run(pool: RecordingPool, **args: Any) -> tuple[Any, list[HarnessEvent]]:
    tool = next(t for t in _tools(pool) if t.name == "ops_workflow")
    events: list[HarnessEvent] = []
    out = await tool.call(CTX, tool.input_model(**args), events.append)
    return out, events


def _sql(pool: RecordingPool) -> list[str]:
    return [sql for sql, _ in pool.conn.fetched if not sql.startswith("EXPLAIN")]


def test_tool_is_registered_only_with_a_workflow_schema() -> None:
    assert "ops_workflow" in [t.name for t in _tools(RecordingPool())]
    assert "ops_workflow" not in [t.name for t in _tools(RecordingPool(), schema=None)]


def _summary(names: list[tuple[str, str]], schemas: tuple[str, ...]) -> SchemaSummary:
    tables = tuple(TableInfo(schema=s, name=n, table_type="BASE TABLE", row_estimate=1)
                   for s, n in names)  # fmt: skip
    return SchemaSummary(
        connection="ops",
        schemas=schemas,
        tables=tables,
        total_tables=len(tables),
        all_table_names=frozenset(n for _, n in names),
    )


@pytest.mark.asyncio
async def test_workflow_schema_is_where_procdef_lives() -> None:
    both = ("app", "wf")
    pool = RecordingPool()
    listed = _summary([("app", "orders"), ("wf", "act_re_procdef")], both)
    assert await workflow_schema(pool, listed, 5000) == "wf"
    assert await workflow_schema(pool, _summary([("app", "orders")], both), 5000) is None
    assert await workflow_schema(pool, None, 5000) is None
    assert pool.conn.fetched == []


@pytest.mark.asyncio
async def test_workflow_schema_past_the_table_cap_is_looked_up() -> None:
    pool = RecordingPool(fetch_return=[{"table_schema": "wf"}])
    capped = _summary([("app", "orders")], ("app", "wf"))
    capped = SchemaSummary(
        connection=capped.connection,
        schemas=capped.schemas,
        tables=capped.tables,
        total_tables=500,
        all_table_names=capped.all_table_names | {"act_re_procdef"},
    )
    assert await workflow_schema(pool, capped, 5000) == "wf"
    [(sql, args)] = pool.conn.fetched
    assert "information_schema.tables" in sql
    assert args == (["app", "wf"],)


@pytest.mark.asyncio
async def test_provider_registers_workflow_for_engine_tables(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def respond(sql: str) -> list[dict[str, Any]]:
        if "pg_catalog.pg_class" in sql:
            return [
                {"table_schema": "wf", "table_name": n, "table_type": "BASE TABLE",
                 "row_estimate": 10}
                for n in ("act_re_procdef", "act_ge_bytearray", "act_hi_actinst")
            ]  # fmt: skip
        return []

    monkeypatch.setattr(
        "miot_harness.integrations.generic_pg.provider.create_pg_pool",
        AsyncMock(return_value=RecordingPool(responder=respond)),
    )
    conn = Connection(
        name="ops",
        backend="pg",
        dsn="postgresql://u:p@h:5/db",
        options={"search_path": "wf"},
        capabilities={"generic_query": True},
        required=False,
    )
    registry = ToolRegistry()
    await GenericPgProvider().boot(registry, HarnessSettings(generic_query_enabled=True), conn)
    assert "ops_workflow" in registry.names()


@pytest.mark.asyncio
async def test_list_groups_versions_with_instance_counts() -> None:
    pool = RecordingPool(responder=_responder())
    out, events = await _run(pool, action="list")
    assert events == []
    assert out.rows[0] == {
        "key": "requestReview",
        "name": "Request review",
        "latest_version": 3,
        "latest_id": "requestReview:3:77",
        "versions": 2,
        "instances": 100,
        "running": 5,
    }
    assert out.rows[1]["instances"] == 0
    assert all('"wf".act_' in sql for sql in _sql(pool))


@pytest.mark.asyncio
async def test_graph_sends_an_svg_artifact_and_returns_the_shape() -> None:
    pool = RecordingPool(responder=_responder())
    out, events = await _run(pool, action="graph", key="requestReview", title="Revisión")
    [event] = events
    assert event.type == "artifact.created"
    assert event.data["kind"] == "svg"
    assert event.data["title"] == "Revisión"
    assert event.data["id"] == out.artifact_id
    assert event.data["content"].startswith("<svg ")
    assert out.process == {
        "id": "requestReview:3:77",
        "key": "requestReview",
        "name": "Request review",
        "version": 3,
    }
    assert len(out.nodes) == 13
    assert {"from": "revise", "to": "register", "back": True} in out.edges
    assert out.mermaid.startswith("flowchart LR")
    sqls = _sql(pool)
    assert "key_ = 'requestReview'" in sqls[0]
    assert "deployment_id_ = '70' AND name_ = 'request_review.bpmn20.xml'" in sqls[1]


@pytest.mark.asyncio
async def test_graph_quotes_the_key_literal() -> None:
    pool = RecordingPool(responder=_responder())
    await _run(pool, action="graph", key="x' OR '1'='1", version=2)
    assert "key_ = 'x'' OR ''1''=''1' AND version_ = 2" in _sql(pool)[0]


@pytest.mark.asyncio
async def test_graph_without_layout_sends_mermaid() -> None:
    import re

    bare = re.sub(
        rb"<bpmndi:BPMNDiagram.*</bpmndi:BPMNDiagram>", b"", FIXTURE.read_bytes(), flags=re.S
    )
    out, [event] = await _run(RecordingPool(responder=_responder(xml=bare)), action="graph", id="x")
    assert event.data["kind"] == "mermaid"
    assert event.data["content"] == out.mermaid
    assert "no saved layout" in out.note


@pytest.mark.asyncio
async def test_graph_heat_colors_by_median_in_the_period() -> None:
    pool = RecordingPool(responder=_responder())
    out, [event] = await _run(
        pool,
        action="graph",
        key="requestReview",
        heat=True,
        since=date(2026, 1, 1),
        until=date(2026, 3, 31),
    )
    assert "Prepare shipment · median 2.0 d" in event.data["content"]
    assert out.period == {"since": "2026-01-01", "until": "2026-03-31"}
    stats_sql = next(s for s in _sql(pool) if "PERCENTILE_CONT" in s)
    assert "start_time_ >= '2026-01-01' AND start_time_ < '2026-04-01'" in stats_sql
    assert "key_ = 'requestReview'" in stats_sql


@pytest.mark.asyncio
async def test_stats_per_task_transitions_and_rework() -> None:
    pool = RecordingPool(responder=_responder())
    out, events = await _run(pool, action="stats", key="requestReview", version=3)
    assert events == []
    ship = out.rows[0]
    assert (ship["task"], ship["open_now"], ship["median"], ship["p90"]) == (
        "ship",
        2,
        "2.0 d",
        "5.0 d",
    )
    assert out.rows[1]["name"] == "Register request"  # from the diagram
    assert out.transitions == [
        {"from": "Register request", "to": "Outcome?", "count": 55, "back": False,
         "in_model": True},
        {"from": "Revise request", "to": "Register request", "count": 15, "back": True,
         "in_model": True},
        {"from": "Prepare shipment", "to": "Notify customer", "count": 3, "back": False,
         "in_model": False},
    ]  # fmt: skip
    assert out.rework == [{"task": "Register request", "instances": 12, "repeats": 15}]
    assert all("proc_def_id_ = 'requestReview:3:77'" in s for s in _sql(pool) if "act_hi_" in s)


@pytest.mark.asyncio
async def test_stats_reports_what_the_cost_gate_skipped() -> None:
    pool = RecordingPool(responder=_responder(expensive="LAG("))
    out, _ = await _run(pool, action="stats", key="requestReview")
    assert out.transitions == []
    assert out.rows
    assert "Skipped: transitions" in out.note


@pytest.mark.asyncio
async def test_graph_needs_a_key_or_id() -> None:
    pool = RecordingPool(responder=_responder())
    with pytest.raises(ValueError, match="pass key"):
        await _run(pool, action="graph")


@pytest.mark.asyncio
async def test_list_without_history_still_lists_definitions() -> None:
    respond = _responder()

    def no_history(sql: str) -> list[dict[str, Any]]:
        if "act_hi_procinst" in sql and not sql.startswith("EXPLAIN"):
            raise RuntimeError('relation "wf.act_hi_procinst" does not exist')
        return respond(sql)

    out, _ = await _run(RecordingPool(responder=no_history), action="list")
    assert [r["key"] for r in out.rows] == ["requestReview", "other"]
    assert "Instance counts skipped" in out.note


@pytest.mark.asyncio
async def test_stats_names_rework_when_only_rework_is_skipped() -> None:
    pool = RecordingPool(responder=_responder(expensive="HAVING"))
    out, _ = await _run(pool, action="stats", key="requestReview")
    assert out.transitions
    assert out.rework == []
    assert "Skipped: rework" in out.note


@pytest.mark.asyncio
async def test_stats_cover_every_task_type() -> None:
    pool = RecordingPool(responder=_responder())
    await _run(pool, action="stats", key="requestReview")
    stats_sql = next(s for s in _sql(pool) if "PERCENTILE_CONT" in s)
    assert "'serviceTask'" in stats_sql
    assert "'userTask'" in stats_sql
