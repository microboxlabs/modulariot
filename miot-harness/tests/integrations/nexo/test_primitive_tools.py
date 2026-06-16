"""Composable primitives exposed as HarnessTools for the agentic executor."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from miot_harness.integrations.nexo.primitive_tools import build_primitive_tools
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.tools.registry import ToolRegistry


class _AcquireCtx:
    def __init__(self, conn: Any) -> None:
        self._conn = conn

    async def __aenter__(self) -> Any:
        return self._conn

    async def __aexit__(self, *args: Any) -> None:
        return None


class _FakePool:
    def __init__(self) -> None:
        self._conn: Any = AsyncMock()

    def acquire(self) -> _AcquireCtx:
        return _AcquireCtx(self._conn)


@pytest.fixture()
def fake_pool() -> _FakePool:
    return _FakePool()


def _ctx(tenant: str = "mintral") -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id=tenant, user_id="u")


def _tools(fake_pool: _FakePool) -> dict[str, Any]:
    tools = build_primitive_tools(
        pool=fake_pool,
        schema="nexo",
        tenant_lock="mintral",
        explain_cost_threshold=10000.0,
        source_label="Coordinador · nexo (Citus DB)",
    )
    return {t.name: t for t in tools}


def test_build_primitive_tools_exposes_all_four(fake_pool: _FakePool) -> None:
    tools = _tools(fake_pool)
    assert set(tools) == {"nexo_describe", "nexo_select", "nexo_grep", "nexo_explain"}
    for tool in tools.values():
        assert tool.kind == "primitive"
        assert tool.read_only is True
        assert tool.description  # planner catalog needs a first line


def test_primitive_tools_register_cleanly(fake_pool: _FakePool) -> None:
    registry = ToolRegistry()
    for tool in _tools(fake_pool).values():
        registry.register(tool)
    assert "nexo_select" in registry.names()


@pytest.mark.asyncio
async def test_nexo_select_tool_returns_rows(fake_pool: _FakePool) -> None:
    fake_pool._conn.fetch = AsyncMock(return_value=[{"id": 1, "status": "open"}])
    tool = _tools(fake_pool)["nexo_select"]

    events: list[HarnessEvent] = []
    output = await tool.invoke(
        _ctx(), {"table": "nexo.dx_servicios", "limit": 10}, events.append
    )

    dump = output.model_dump()
    assert dump["rows"] == [{"id": 1, "status": "open"}]
    assert dump["source"] == "Coordinador · nexo (Citus DB)"
    assert any(e.type == "tool.completed" for e in events)


@pytest.mark.asyncio
async def test_primitive_tool_denies_off_lock_tenant(fake_pool: _FakePool) -> None:
    tool = _tools(fake_pool)["nexo_describe"]
    events: list[HarnessEvent] = []
    with pytest.raises(PermissionError):
        await tool.invoke(_ctx(tenant="other"), {"table": "nexo.dx_servicios"}, events.append)


@pytest.mark.asyncio
async def test_safety_gate_violation_surfaces_as_tool_failure(fake_pool: _FakePool) -> None:
    """An out-of-allowlist table must raise (and emit tool.failed) — the
    executor turns this into state['failure'], never a crash."""
    tool = _tools(fake_pool)["nexo_select"]
    events: list[HarnessEvent] = []
    with pytest.raises(Exception, match="allowlist"):
        await tool.invoke(_ctx(), {"table": "public.users"}, events.append)
    assert any(e.type == "tool.failed" for e in events)


@pytest.mark.asyncio
async def test_nexo_grep_tool_passes_pattern(fake_pool: _FakePool) -> None:
    fake_pool._conn.fetch = AsyncMock(return_value=[])
    tool = _tools(fake_pool)["nexo_grep"]
    events: list[HarnessEvent] = []
    await tool.invoke(
        _ctx(),
        {"table": "nexo.dx_servicios", "column": "carrier", "pattern": "%lib%"},
        events.append,
    )
    args, _ = fake_pool._conn.fetch.call_args
    assert args[-1] == "%lib%"
