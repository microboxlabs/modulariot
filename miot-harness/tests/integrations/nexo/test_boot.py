from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from miot_harness.config import HarnessSettings
from miot_harness.integrations.nexo.boot import (
    NexoBootResult,
    load_nexo_tools,
)
from miot_harness.integrations.nexo.introspect import (
    FunctionArg,
    FunctionDescriptor,
    ParsedDescription,
)
from miot_harness.tools.registry import ToolRegistry


def _descriptor(name: str = "fn_dx_centro_control") -> FunctionDescriptor:
    return FunctionDescriptor(
        name=name,
        proc_oid=10,
        description=ParsedDescription(layer="L1", body="kpi"),
        args=[
            FunctionArg(name="p_tenant", pg_type="text", has_default=True, default_expr="'mintral'")
        ],
        returns_kind="table",
        returns_columns=[("refreshed_at_servicios", "timestamptz")],
    )


def _settings(**overrides) -> HarnessSettings:
    base = {
        "nexo_freshness_refuse_minutes": 240,
    }
    base.update(overrides)
    return HarnessSettings(**base)


def _mock_pool(centro_refreshed: datetime, fn_refresh_leak: int = 0) -> MagicMock:
    fake_conn = MagicMock()

    async def fetchrow(sql, *args):
        sql_upper = sql.upper()
        if "FN_DX_CENTRO_CONTROL" in sql_upper:
            return {"refreshed_at_servicios": centro_refreshed}
        if "FN_REFRESH_DIRECT_LEAK" in sql or "fn_refresh_direct_leak" in sql:
            return {"fn_refresh_direct_leak": fn_refresh_leak}
        if "DEFAULT_TRANSACTION_READ_ONLY" in sql_upper or "current_setting" in sql:
            return {"read_only": "on"}
        return {}

    fake_conn.fetchrow = AsyncMock(side_effect=fetchrow)
    fake_conn.execute = AsyncMock()

    txn_cm = MagicMock()
    txn_cm.__aenter__ = AsyncMock(return_value=None)
    txn_cm.__aexit__ = AsyncMock(return_value=None)
    fake_conn.transaction = MagicMock(return_value=txn_cm)

    pool = MagicMock()
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=fake_conn)
    cm.__aexit__ = AsyncMock(return_value=None)
    pool.acquire = MagicMock(return_value=cm)
    return pool


@pytest.mark.asyncio
async def test_happy_path_registers_tools(monkeypatch):
    descriptors = [_descriptor("fn_dx_centro_control"), _descriptor("fn_dx_kpi_servicio")]
    monkeypatch.setattr(
        "miot_harness.integrations.nexo.boot.introspect_nexo_functions",
        AsyncMock(return_value=descriptors),
    )

    registry = ToolRegistry()
    pool = _mock_pool(centro_refreshed=datetime.now(UTC) - timedelta(minutes=5))

    result = await load_nexo_tools(registry, settings=_settings(), pool=pool)

    assert isinstance(result, NexoBootResult)
    assert result.enabled is True
    assert result.registered == ["coordinador_centro_control", "coordinador_kpi_servicio"]
    assert "coordinador_centro_control" in registry.names()


@pytest.mark.asyncio
async def test_fn_refresh_leak_disables_nexo(monkeypatch):
    monkeypatch.setattr(
        "miot_harness.integrations.nexo.boot.introspect_nexo_functions",
        AsyncMock(return_value=[_descriptor()]),
    )
    registry = ToolRegistry()
    pool = _mock_pool(centro_refreshed=datetime.now(UTC), fn_refresh_leak=3)

    result = await load_nexo_tools(registry, settings=_settings(), pool=pool)

    assert result.enabled is False
    assert "fn_refresh" in (result.reason or "").lower()
    assert registry.names() == []


@pytest.mark.asyncio
async def test_stale_centro_control_disables_nexo(monkeypatch):
    monkeypatch.setattr(
        "miot_harness.integrations.nexo.boot.introspect_nexo_functions",
        AsyncMock(return_value=[_descriptor()]),
    )
    registry = ToolRegistry()
    very_old = datetime.now(UTC) - timedelta(hours=72)
    pool = _mock_pool(centro_refreshed=very_old)

    result = await load_nexo_tools(
        registry,
        settings=_settings(nexo_freshness_refuse_minutes=240),
        pool=pool,
    )

    assert result.enabled is False
    assert "stale" in (result.reason or "").lower() or "freshness" in (result.reason or "").lower()


@pytest.mark.asyncio
async def test_no_pool_disables_nexo_without_raising():
    registry = ToolRegistry()
    result = await load_nexo_tools(registry, settings=_settings(), pool=None)
    assert result.enabled is False
    assert registry.names() == []
    assert (
        "tunnel" in (result.reason or "").lower()
        or "pool" in (result.reason or "").lower()
        or "disabled" in (result.reason or "").lower()
    )


@pytest.mark.asyncio
async def test_connection_failure_disables_nexo_without_raising(monkeypatch):
    """Tunnel down → asyncpg connect raises. Boot should log + return disabled."""
    monkeypatch.setattr(
        "miot_harness.integrations.nexo.boot.introspect_nexo_functions",
        AsyncMock(side_effect=ConnectionRefusedError("tunnel down")),
    )
    registry = ToolRegistry()
    pool = _mock_pool(centro_refreshed=datetime.now(UTC))

    result = await load_nexo_tools(registry, settings=_settings(), pool=pool)
    assert result.enabled is False


@pytest.mark.asyncio
async def test_invalid_schema_name_disables_nexo():
    """Operator-supplied schema must match [a-z_][a-z0-9_]* — refuse otherwise."""
    registry = ToolRegistry()
    pool = _mock_pool(centro_refreshed=datetime.now(UTC))
    bad_settings = _settings(nexo_search_path="public; DROP TABLE x")

    result = await load_nexo_tools(registry, settings=bad_settings, pool=pool)

    assert result.enabled is False
    assert "schema" in (result.reason or "").lower()
    assert registry.names() == []
