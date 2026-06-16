from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError

from miot_harness.integrations.nexo.introspect import (
    FunctionArg,
    FunctionDescriptor,
    ParsedDescription,
)
from miot_harness.integrations.nexo.tool_factory import (
    SHARED_FILTER_PRIMER,
    build_nexo_tool,
)
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionDecision


def _ctx(tenant_id: str = "mintral") -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id=tenant_id, user_id="u")


def _table_descriptor() -> FunctionDescriptor:
    return FunctionDescriptor(
        name="fn_dx_centro_control",
        proc_oid=12345,
        description=ParsedDescription(
            title="Centro de control",
            body="Top-level KPI summary.",
            layer="meta",
            meta={"domain": "[services, fleet]", "returns": "kpi_summary", "side_effects": "none"},
        ),
        args=[
            FunctionArg(
                name="p_tenant", pg_type="text", has_default=True, default_expr="'mintral'"
            ),
            FunctionArg(
                name="p_window_hours", pg_type="integer", has_default=True, default_expr="24"
            ),
        ],
        returns_kind="table",
        returns_columns=[
            ("n_eta_riesgo", "integer"),
            ("n_pod_pendiente", "integer"),
            ("refreshed_at_servicios", "timestamptz"),
        ],
    )


def _json_descriptor() -> FunctionDescriptor:
    return FunctionDescriptor(
        name="fn_dx_kpi_servicio",
        proc_oid=12346,
        description=ParsedDescription(layer="L3", body="per-service KPI"),
        args=[
            FunctionArg(
                name="p_servicio_id", pg_type="bigint", has_default=False, default_expr=None
            )
        ],
        returns_kind="json",
        returns_columns=[],
    )


def test_tool_name_strips_fn_dx_prefix():
    tool = build_nexo_tool(_table_descriptor(), pool=MagicMock(), tenant_lock="mintral")
    assert tool.name == "coordinador_centro_control"


def test_description_includes_shared_filter_primer():
    tool = build_nexo_tool(_table_descriptor(), pool=MagicMock(), tenant_lock="mintral")
    assert SHARED_FILTER_PRIMER in tool.description


def test_meta_description_renders_title_body_meta_hints():
    tool = build_nexo_tool(_table_descriptor(), pool=MagicMock(), tenant_lock="mintral")
    desc = tool.description
    assert "Centro de control" in desc
    assert "Top-level KPI summary" in desc
    assert "Domain" in desc
    assert "Returns" in desc


def test_layer_prefix_description_renders_layer_tag():
    tool = build_nexo_tool(_json_descriptor(), pool=MagicMock(), tenant_lock="mintral")
    assert "[Layer L3]" in tool.description
    assert "per-service KPI" in tool.description


def test_input_model_fields_optional_when_default_present():
    tool = build_nexo_tool(_table_descriptor(), pool=MagicMock(), tenant_lock="mintral")
    # Should be fully constructible with no input — both args have defaults
    model = tool.input_model()
    assert model.model_dump() == {"p_tenant": None, "p_window_hours": None}


def test_input_model_field_required_when_no_default():
    tool = build_nexo_tool(_json_descriptor(), pool=MagicMock(), tenant_lock="mintral")
    # p_servicio_id is required (no default)
    with pytest.raises(ValidationError):
        tool.input_model()
    instance = tool.input_model(p_servicio_id=42)
    assert instance.p_servicio_id == 42


def test_input_model_pg_type_to_python_mapping():
    descriptor = FunctionDescriptor(
        name="fn_dx_x",
        proc_oid=1,
        description=ParsedDescription(),
        args=[
            FunctionArg(name="p_text", pg_type="text", has_default=True, default_expr="''"),
            FunctionArg(name="p_int", pg_type="integer", has_default=True, default_expr="0"),
            FunctionArg(name="p_bool", pg_type="boolean", has_default=True, default_expr="false"),
            FunctionArg(name="p_ts", pg_type="timestamptz", has_default=True, default_expr="now()"),
        ],
        returns_kind="json",
        returns_columns=[],
    )
    tool = build_nexo_tool(descriptor, pool=MagicMock(), tenant_lock="mintral")
    fields = tool.input_model.model_fields
    # pydantic exposes annotation under .annotation
    assert "p_text" in fields
    assert "p_int" in fields
    assert "p_bool" in fields
    assert "p_ts" in fields


@pytest.mark.asyncio
async def test_check_permission_denies_cross_tenant():
    tool = build_nexo_tool(_table_descriptor(), pool=MagicMock(), tenant_lock="mintral")
    decision = await tool.check_permission(_ctx(tenant_id="demo-tenant"), tool.input_model())
    assert decision.decision == PermissionDecision.DENY
    assert "Mintral" in decision.reason or "mintral" in decision.reason.lower()


@pytest.mark.asyncio
async def test_check_permission_allows_locked_tenant():
    tool = build_nexo_tool(_table_descriptor(), pool=MagicMock(), tenant_lock="mintral")
    decision = await tool.check_permission(_ctx(tenant_id="mintral"), tool.input_model())
    assert decision.decision == PermissionDecision.ALLOW


def _make_pool_with_rows(rows: list[dict[str, Any]]) -> MagicMock:
    """Build an async-context-manager-shaped pool/connection that returns rows."""

    class _RowDict(dict):
        # asyncpg.Record-like just enough for _row_to_dict
        pass

    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=[_RowDict(r) for r in rows])
    fake_conn.execute = AsyncMock()

    txn_cm = MagicMock()
    txn_cm.__aenter__ = AsyncMock(return_value=None)
    txn_cm.__aexit__ = AsyncMock(return_value=None)
    fake_conn.transaction = MagicMock(return_value=txn_cm)

    acquire_cm = MagicMock()
    acquire_cm.__aenter__ = AsyncMock(return_value=fake_conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=None)

    pool = MagicMock()
    pool.acquire = MagicMock(return_value=acquire_cm)
    return pool


@pytest.mark.asyncio
async def test_invoke_runs_sql_and_lifts_metadata_into_event():
    """invoke() acquires a connection, opens a read-only transaction,
    runs SELECT * FROM nexo.<fn>($1,...), surfaces refreshed_at_* +
    truncation flag in the output, and HarnessTool.invoke lifts the
    output's metadata fields into the single tool.completed event.
    """
    refreshed = datetime(2026, 5, 8, 10, 0, tzinfo=UTC)
    rows = [
        {
            "n_eta_riesgo": 3,
            "n_pod_pendiente": 1,
            "refreshed_at_servicios": refreshed,
        }
    ]
    pool = _make_pool_with_rows(rows)
    tool = build_nexo_tool(_table_descriptor(), pool=pool, tenant_lock="mintral")
    progress_events: list[Any] = []

    output = await tool.invoke(_ctx(), {}, progress_events.append)

    dump = output.model_dump()
    assert dump.get("refreshed_at") == refreshed
    assert dump["rows"][0]["n_eta_riesgo"] == 3
    completed = [e for e in progress_events if e.type == "tool.completed"]
    assert len(completed) == 1, "exactly one tool.completed per invocation"
    data = completed[0].data
    assert data["source"].startswith("Coordinador")
    assert data["refreshed_at"] == refreshed
    assert data["layer"] == "meta"
    assert data["truncated"] is False


@pytest.mark.asyncio
async def test_invoke_truncates_long_row_lists():
    """S9: row lists capped at 5; truncated=True; total_count preserved."""
    refreshed = datetime(2026, 5, 8, 10, 0, tzinfo=UTC)
    rows = [{"servicio_id": i, "refreshed_at_servicios": refreshed} for i in range(12)]
    pool = _make_pool_with_rows(rows)
    tool = build_nexo_tool(_table_descriptor(), pool=pool, tenant_lock="mintral")
    events: list[Any] = []

    output = await tool.invoke(_ctx(), {}, events.append)
    dump = output.model_dump()

    assert dump["truncated"] is True
    assert dump["total_count"] == 12
    assert len(dump["rows"]) == 5
    completed = [e for e in events if e.type == "tool.completed"]
    assert completed[0].data["truncated"] is True


def test_text_args_coerce_numeric_input():
    """All Coordinador p_* filters are pg `text`, but LLM planners emit
    JSON numbers for ids ("p_service_code": 1643006). Pydantic v2 rejects
    int→str by default, which would turn a perfectly valid tool call into
    a failure — coerce numerics to strings for text-typed args (Gap 3)."""
    descriptor = FunctionDescriptor(
        name="fn_dx_task_timeline",
        proc_oid=2,
        description=ParsedDescription(layer="L3", body="Timeline de tareas"),
        args=[
            FunctionArg(
                name="p_service_code", pg_type="text", has_default=True, default_expr="NULL"
            ),
            FunctionArg(
                name="p_semanas", pg_type="integer", has_default=True, default_expr="8"
            ),
        ],
        returns_kind="table",
        returns_columns=[],
    )
    tool = build_nexo_tool(descriptor, pool=MagicMock(), tenant_lock="mintral")

    parsed = tool.input_model.model_validate({"p_service_code": 1643006})
    assert parsed.p_service_code == "1643006"

    # Integer-typed args keep their type — coercion is text-field-only.
    parsed = tool.input_model.model_validate({"p_service_code": "1643006", "p_semanas": 4})
    assert parsed.p_semanas == 4

    # Booleans are NOT silently stringified into text fields.
    with pytest.raises(ValidationError):
        tool.input_model.model_validate({"p_service_code": True})


def test_freshest_refreshed_at_coerces_naive_and_takes_max():
    from datetime import UTC, datetime

    from miot_harness.integrations.nexo.tool_factory import freshest_refreshed_at

    aware_new = datetime(2026, 6, 12, 12, 0, tzinfo=UTC)
    naive_old = datetime(2026, 5, 1, 12, 0)  # pg `timestamp` w/o tz
    result = freshest_refreshed_at(
        [{"refreshed_at_torre": naive_old}, {"refreshed_at_servicios": aware_new}]
    )
    assert result == aware_new
    # All-naive input returns an aware (UTC) result so downstream age
    # math never hits naive-vs-aware TypeError.
    result = freshest_refreshed_at([{"refreshed_at_x": naive_old}])
    assert result is not None and result.tzinfo is not None


@pytest.mark.asyncio
async def test_invoke_uses_freshest_refreshed_at_across_rows():
    """Multi-layer outputs (one row per capa, each with its own
    refreshed_at_*) must surface the FRESHEST timestamp, not row 0's."""
    from datetime import UTC, datetime, timedelta

    stale = datetime.now(UTC) - timedelta(days=33)
    fresh = datetime.now(UTC)

    class _RowDict(dict):
        pass

    rows = [
        _RowDict({"capa": "torre", "refreshed_at_torre": stale}),
        _RowDict({"capa": "servicios", "refreshed_at_servicios": fresh}),
    ]
    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=rows)
    fake_conn.execute = AsyncMock()
    txn = MagicMock()
    txn.__aenter__ = AsyncMock(return_value=None)
    txn.__aexit__ = AsyncMock(return_value=None)
    fake_conn.transaction = MagicMock(return_value=txn)
    pool = MagicMock()
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=fake_conn)
    cm.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=cm)

    tool = build_nexo_tool(_table_descriptor(), pool=pool, tenant_lock="mintral")
    output = await tool.invoke(_ctx(), {}, lambda e: None)
    assert output.model_dump()["refreshed_at"] == fresh
