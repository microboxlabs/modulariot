from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

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


def _boot_kwargs(**overrides) -> dict:
    """Resolved provider-private kwargs for ``load_nexo_tools``.

    Mirrors what ``NexoProvider.boot`` passes in: schema from
    NexoSettings, effective tenant_lock / refuse_minutes.
    """
    base = {
        "schema": "nexo",
        "tenant_lock": "mintral",
        "refuse_minutes": 240,
        # No sleeping between probe retries in tests.
        "probe_retry_delay_s": 0.0,
    }
    base.update(overrides)
    return base


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

    async def fetch(sql, *args):
        # Boot's freshness probe (and the survey) read via conn.fetch.
        if "fn_dx_centro_control" in sql:
            return [{"refreshed_at_servicios": centro_refreshed}]
        return []

    fake_conn.fetch = AsyncMock(side_effect=fetch)
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

    result = await load_nexo_tools(registry, **_boot_kwargs(), pool=pool)

    assert isinstance(result, NexoBootResult)
    assert result.enabled is True
    assert result.registered == ["coordinador_centro_control", "coordinador_kpi_servicio"]
    assert "coordinador_centro_control" in registry.names()


@pytest.mark.asyncio
async def test_boot_surveys_freshness_and_builds_catalog(monkeypatch):
    """Boot must survey per-function freshness and derive meta-catalog
    entries (descriptor title/layer/body + freshness suffix) so /health
    and the meta agent can expose what's fresh vs stale up front."""
    now = datetime.now(UTC)
    descriptors = [
        _descriptor("fn_dx_centro_control"),
        _descriptor("fn_dx_task_timeline"),
    ]
    monkeypatch.setattr(
        "miot_harness.integrations.nexo.boot.introspect_nexo_functions",
        AsyncMock(return_value=descriptors),
    )
    registry = ToolRegistry()
    pool = _mock_pool(centro_refreshed=now - timedelta(minutes=5))

    async def fetch(sql, *args):
        if "fn_dx_centro_control" in sql:
            return [{"n": 1, "refreshed_at_servicios": now - timedelta(minutes=5)}]
        if "fn_dx_task_timeline" in sql:
            return []
        return []

    # pool.acquire() returns the same fake conn; wire fetch for the survey.
    pool.acquire.return_value.__aenter__.return_value.fetch = AsyncMock(side_effect=fetch)

    result = await load_nexo_tools(registry, **_boot_kwargs(), pool=pool)

    assert result.enabled is True
    assert result.freshness["fn_dx_centro_control"].status == "fresh"
    assert result.freshness["fn_dx_task_timeline"].status == "empty_no_timestamp"

    entries = {e.name: e for e in result.catalog_entries}
    assert set(entries) == {"coordinador_centro_control", "coordinador_task_timeline"}
    centro = entries["coordinador_centro_control"]
    assert centro.layer == "L1"
    assert "kpi" in centro.body
    assert "Último refresh" in centro.body
    timeline = entries["coordinador_task_timeline"]
    assert "sin refrescar" in timeline.body


@pytest.mark.asyncio
async def test_boot_survey_disabled_yields_no_freshness(monkeypatch):
    monkeypatch.setattr(
        "miot_harness.integrations.nexo.boot.introspect_nexo_functions",
        AsyncMock(return_value=[_descriptor("fn_dx_centro_control")]),
    )
    registry = ToolRegistry()
    pool = _mock_pool(centro_refreshed=datetime.now(UTC))

    result = await load_nexo_tools(
        registry, **_boot_kwargs(), pool=pool, survey_enabled=False
    )

    assert result.enabled is True
    assert result.freshness == {}
    # Catalog entries are still descriptor-derived (no freshness suffix).
    assert [e.name for e in result.catalog_entries] == ["coordinador_centro_control"]


@pytest.mark.asyncio
async def test_fn_refresh_leak_disables_nexo(monkeypatch):
    monkeypatch.setattr(
        "miot_harness.integrations.nexo.boot.introspect_nexo_functions",
        AsyncMock(return_value=[_descriptor()]),
    )
    registry = ToolRegistry()
    pool = _mock_pool(centro_refreshed=datetime.now(UTC), fn_refresh_leak=3)

    result = await load_nexo_tools(registry, **_boot_kwargs(), pool=pool)

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
        **_boot_kwargs(refuse_minutes=240),
        pool=pool,
    )

    assert result.enabled is False
    assert "stale" in (result.reason or "").lower() or "freshness" in (result.reason or "").lower()


@pytest.mark.asyncio
async def test_no_pool_disables_nexo_without_raising():
    registry = ToolRegistry()
    result = await load_nexo_tools(registry, **_boot_kwargs(), pool=None)
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

    result = await load_nexo_tools(registry, **_boot_kwargs(), pool=pool)
    assert result.enabled is False


@pytest.mark.asyncio
async def test_invalid_schema_name_disables_nexo():
    """Operator-supplied schema must match [a-z_][a-z0-9_]* — refuse otherwise."""
    registry = ToolRegistry()
    pool = _mock_pool(centro_refreshed=datetime.now(UTC))
    result = await load_nexo_tools(
        registry, **_boot_kwargs(schema="public; DROP TABLE x"), pool=pool
    )

    assert result.enabled is False
    assert "schema" in (result.reason or "").lower()
    assert registry.names() == []


@pytest.mark.asyncio
async def test_boot_probe_uses_freshest_row_across_layers(monkeypatch):
    """fn_dx_centro_control returns one row PER LAYER, each with its own
    refreshed_at_*. A LIMIT 1 probe lands on an arbitrary row (no ORDER
    BY), so a single month-stale layer (capa torre) could flakily disable
    the whole integration. The gate must consider the freshest timestamp
    across all returned rows."""
    monkeypatch.setattr(
        "miot_harness.integrations.nexo.boot.introspect_nexo_functions",
        AsyncMock(return_value=[_descriptor("fn_dx_centro_control")]),
    )
    registry = ToolRegistry()
    stale_torre = datetime.now(UTC) - timedelta(days=33)
    fresh_servicios = datetime.now(UTC) - timedelta(minutes=5)
    pool = _mock_pool(centro_refreshed=stale_torre)

    async def fetch(sql, *args):
        if "fn_dx_centro_control" in sql:
            return [
                {"capa": "torre", "refreshed_at_torre": stale_torre},
                {"capa": "servicios", "refreshed_at_servicios": fresh_servicios},
            ]
        return []

    conn = pool.acquire.return_value.__aenter__.return_value
    conn.fetch = AsyncMock(side_effect=fetch)
    # fetchrow no longer drives the gate; the multi-row fetch does.

    result = await load_nexo_tools(registry, **_boot_kwargs(), pool=pool)

    assert result.enabled is True
    assert result.snapshot_age_minutes is not None
    assert result.snapshot_age_minutes < 30


@pytest.mark.asyncio
async def test_boot_probe_retries_through_transient_refresh_window(monkeypatch):
    """The snapshot refresh job briefly NULLs refreshed_at_servicios while
    rebuilding; a single point-in-time probe lands in that window and
    flakily disables the whole integration (live repro 2026-06-11). The
    gate must retry before refusing."""
    monkeypatch.setattr(
        "miot_harness.integrations.nexo.boot.introspect_nexo_functions",
        AsyncMock(return_value=[_descriptor("fn_dx_centro_control")]),
    )
    registry = ToolRegistry()
    stale_torre = datetime.now(UTC) - timedelta(days=33)
    fresh = datetime.now(UTC)
    pool = _mock_pool(centro_refreshed=fresh)

    calls = {"n": 0}

    async def fetch(sql, *args):
        if "fn_dx_centro_control" in sql:
            calls["n"] += 1
            if calls["n"] == 1:
                # Mid-refresh: servicios timestamp NULL, only stale torre.
                return [{"refreshed_at_servicios": None, "refreshed_at_torre": stale_torre}]
            return [{"refreshed_at_servicios": fresh, "refreshed_at_torre": stale_torre}]
        return []

    conn = pool.acquire.return_value.__aenter__.return_value
    conn.fetch = AsyncMock(side_effect=fetch)

    result = await load_nexo_tools(registry, **_boot_kwargs(), pool=pool)

    assert result.enabled is True
    assert result.snapshot_age_minutes is not None
    assert result.snapshot_age_minutes < 30
    assert calls["n"] >= 2
