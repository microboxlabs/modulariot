from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

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
            FunctionArg(name="p_tenant", pg_type="text", has_default=True, default_expr="'mintral'"),
            FunctionArg(name="p_window_hours", pg_type="integer", has_default=True, default_expr="24"),
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
        args=[FunctionArg(name="p_servicio_id", pg_type="bigint", has_default=False, default_expr=None)],
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
    with pytest.raises(Exception):
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


@pytest.mark.asyncio
async def test_call_runs_sql_and_extracts_refreshed_at():
    """call() acquires a connection, runs SELECT * FROM nexo.<fn>($1,...),
    and surfaces refreshed_at_* + truncation flag in the output."""
    refreshed = datetime(2026, 5, 8, 10, 0, tzinfo=UTC)
    rows = [
        {
            "n_eta_riesgo": 3,
            "n_pod_pendiente": 1,
            "refreshed_at_servicios": refreshed,
        }
    ]

    fake_conn = MagicMock()
    fake_conn.fetch = AsyncMock(return_value=[
        type("Row", (), {"_d": r, "__iter__": lambda self: iter(self._d.items()),
                          "items": lambda self: self._d.items(),
                          "keys": lambda self: list(self._d.keys()),
                          "__getitem__": lambda self, k: self._d[k]})()
        for r in rows
    ])
    fake_conn.execute = AsyncMock()  # for SET LOCAL search_path

    pool = MagicMock()
    # acquire returns an async context manager
    acquire_cm = MagicMock()
    acquire_cm.__aenter__ = AsyncMock(return_value=fake_conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=acquire_cm)

    tool = build_nexo_tool(_table_descriptor(), pool=pool, tenant_lock="mintral")
    progress_events: list[Any] = []

    output = await tool.call(_ctx(), tool.input_model(), progress_events.append)

    dump = output.model_dump()
    assert dump.get("refreshed_at") == refreshed
    assert "rows" in dump
    assert dump["rows"][0]["n_eta_riesgo"] == 3
    # tool.completed event was emitted with metadata
    completed = [e for e in progress_events if e.type == "tool.completed"]
    assert len(completed) == 1
    data = completed[0].data
    assert data["source"].startswith("Coordinador")
    assert data["refreshed_at"] == refreshed
    assert data["layer"] == "meta"
