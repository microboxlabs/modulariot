"""GenericPgProvider: flag/capability gating, schema policy, tool registration."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from miot_harness.config import HarnessSettings
from miot_harness.connections.models import Connection
from miot_harness.integrations.generic_pg.provider import GenericPgProvider
from miot_harness.runtime.context import HarnessContext
from miot_harness.tools.registry import ToolRegistry
from tests.fixtures.recording_pool import RecordingPool


def _t(name: str, est: int) -> dict:
    return {
        "table_schema": "acs",
        "table_name": name,
        "table_type": "BASE TABLE",
        "row_estimate": est,
    }


_TABLE_ROWS = [_t("act_ru_task", 1200), _t("act_ru_execution", 800)]
_COL_ROWS = [
    {"column_name": "id_", "data_type": "character varying"},
    {"column_name": "execution_id_", "data_type": "character varying"},
]
_FK_ROWS = [
    {
        "column": "execution_id_",
        "ref_schema": "acs",
        "ref_table": "act_ru_execution",
        "ref_column": "id_",
        "constraint": "act_fk_task_exe",
    }
]


def _responder(sql: str) -> list:
    if "pg_catalog.pg_class" in sql:
        return _TABLE_ROWS
    if "information_schema.columns" in sql:
        return _COL_ROWS
    if "FOREIGN KEY" in sql:
        return _FK_ROWS
    return []


def _conn(**overrides: object) -> Connection:
    base: dict[str, object] = {
        "name": "acs",
        "backend": "pg",
        "dsn": "postgresql://u:p@h:5/db",
        "options": {"search_path": "acs"},
        "capabilities": {"generic_query": True},
        "primer": "ACS primer",
        "required": False,
    }
    base.update(overrides)
    return Connection(**base)  # type: ignore[arg-type]


def _enabled() -> HarnessSettings:
    # Schema introspection off by default in these registration/gating tests
    # (they use a bare MagicMock pool); the dedicated introspection test below
    # exercises it with a recording pool.
    return HarnessSettings(
        generic_query_enabled=True, generic_schema_introspect_enabled=False
    )


@pytest.mark.asyncio
async def test_boot_disabled_when_master_flag_off() -> None:
    result = await GenericPgProvider().boot(
        ToolRegistry(), HarnessSettings(generic_query_enabled=False), _conn()
    )
    assert result.enabled is False
    assert "disabled" in (result.reason or "")


@pytest.mark.asyncio
async def test_boot_disabled_when_capability_not_declared() -> None:
    result = await GenericPgProvider().boot(
        ToolRegistry(), _enabled(), _conn(capabilities={})
    )
    assert result.enabled is False
    assert "generic_query" in (result.reason or "")


@pytest.mark.asyncio
async def test_boot_disabled_when_no_dsn() -> None:
    result = await GenericPgProvider().boot(ToolRegistry(), _enabled(), _conn(dsn=None))
    assert result.enabled is False
    assert "DSN" in (result.reason or "")


@pytest.mark.asyncio
async def test_boot_disabled_when_no_schemas() -> None:
    result = await GenericPgProvider().boot(
        ToolRegistry(), _enabled(), _conn(options={})
    )
    assert result.enabled is False
    assert "schemas" in (result.reason or "")


@pytest.mark.asyncio
async def test_boot_disabled_on_invalid_option() -> None:
    result = await GenericPgProvider().boot(
        ToolRegistry(),
        _enabled(),
        _conn(options={"search_path": "acs", "max_rows": "abc"}),
    )
    assert result.enabled is False
    assert "invalid option" in (result.reason or "")


@pytest.mark.asyncio
async def test_boot_registers_generic_tools(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_pool = MagicMock()
    fake_pool.close = AsyncMock()
    monkeypatch.setattr(
        "miot_harness.integrations.generic_pg.provider.create_pg_pool",
        AsyncMock(return_value=fake_pool),
    )
    provider = GenericPgProvider()
    registry = ToolRegistry()
    result = await provider.boot(registry, _enabled(), _conn())
    assert result.enabled is True
    for name in (
        "acs_list_tables",
        "acs_describe",
        "acs_select",
        "acs_query",
        "acs_grep",
        "acs_explain",
    ):
        assert name in registry.names()
        assert registry.get(name).kind == "primitive"
        assert name in result.registered
    # Profile is built from the connection (prefix + primer).
    assert provider.profile.name == "acs"
    assert provider.profile.tool_prefix == "acs_"
    assert provider.profile.primer == "ACS primer"
    await provider.close()
    fake_pool.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_boot_pool_failure_returns_disabled_and_no_leak(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _boom(*args: object, **kwargs: object) -> None:
        raise RuntimeError("connection refused")

    monkeypatch.setattr(
        "miot_harness.integrations.generic_pg.provider.create_pg_pool", _boom
    )
    provider = GenericPgProvider()
    result = await provider.boot(ToolRegistry(), _enabled(), _conn())
    assert result.enabled is False
    assert "connection refused" in (result.reason or "")
    assert provider._pool is None


@pytest.mark.asyncio
async def test_tenant_lock_denies_other_tenant(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_pool = MagicMock()
    fake_pool.close = AsyncMock()
    monkeypatch.setattr(
        "miot_harness.integrations.generic_pg.provider.create_pg_pool",
        AsyncMock(return_value=fake_pool),
    )
    registry = ToolRegistry()
    await GenericPgProvider().boot(
        registry,
        _enabled(),
        _conn(options={"search_path": "acs", "tenant_lock": "acme"}),
    )
    tool = registry.get("acs_select")
    from miot_harness.runtime.permissions import PermissionDecision

    def _ctx(tenant: str) -> HarnessContext:
        return HarnessContext(thread_id="t", tenant_id=tenant, user_id="u")

    deny = await tool.check_permission(_ctx("other"), tool.input_model(table="acs.x"))
    allow = await tool.check_permission(_ctx("acme"), tool.input_model(table="acs.x"))
    assert deny.decision == PermissionDecision.DENY
    assert allow.decision == PermissionDecision.ALLOW


@pytest.mark.asyncio
async def test_boot_populates_schema_summary(monkeypatch: pytest.MonkeyPatch) -> None:
    pool = RecordingPool(responder=_responder)
    monkeypatch.setattr(
        "miot_harness.integrations.generic_pg.provider.create_pg_pool",
        AsyncMock(return_value=pool),
    )
    result = await GenericPgProvider().boot(
        ToolRegistry(),
        HarnessSettings(
            generic_query_enabled=True, generic_schema_introspect_enabled=True
        ),
        _conn(),
    )
    assert result.enabled is True
    assert result.schema_summary is not None
    assert result.schema_summary.total_tables == 2
    assert {t.name for t in result.schema_summary.tables} == {
        "act_ru_task",
        "act_ru_execution",
    }


@pytest.mark.asyncio
async def test_describe_returns_columns_and_fks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pool = RecordingPool(responder=_responder)
    monkeypatch.setattr(
        "miot_harness.integrations.generic_pg.provider.create_pg_pool",
        AsyncMock(return_value=pool),
    )
    registry = ToolRegistry()
    await GenericPgProvider().boot(
        registry,
        HarnessSettings(
            generic_query_enabled=True, generic_schema_introspect_enabled=False
        ),
        _conn(),
    )
    tool = registry.get("acs_describe")
    out = await tool.invoke(
        HarnessContext(thread_id="t", tenant_id="demo", user_id="u"),
        {"table": "acs.act_ru_task"},
        lambda _e: None,
    )
    assert any(c["column_name"] == "id_" for c in out.columns)
    assert out.foreign_keys == [
        {"column": "execution_id_", "references": "acs.act_ru_execution.id_"}
    ]
