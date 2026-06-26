"""GenericPgProvider: flag/capability gating, schema policy, tool registration."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from miot_harness.config import HarnessSettings
from miot_harness.connections.models import Connection
from miot_harness.integrations.generic_pg.provider import GenericPgProvider
from miot_harness.tools.registry import ToolRegistry


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
    return HarnessSettings(generic_query_enabled=True)


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
    from miot_harness.runtime.context import HarnessContext
    from miot_harness.runtime.permissions import PermissionDecision

    def _ctx(tenant: str) -> HarnessContext:
        return HarnessContext(thread_id="t", tenant_id=tenant, user_id="u")

    deny = await tool.check_permission(_ctx("other"), tool.input_model(table="acs.x"))
    allow = await tool.check_permission(_ctx("acme"), tool.input_model(table="acs.x"))
    assert deny.decision == PermissionDecision.DENY
    assert allow.decision == PermissionDecision.ALLOW
