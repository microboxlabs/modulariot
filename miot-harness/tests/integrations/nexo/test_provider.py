"""NexoProvider: profile carries today's exact runtime strings, and
boot() degrades to disabled when no DSN is configured."""

from __future__ import annotations

import pytest

from miot_harness.config import HarnessSettings
from miot_harness.integrations.nexo.provider import NEXO_PROFILE, NexoProvider
from miot_harness.tools.registry import ToolRegistry


def test_profile_values_match_legacy_hardcodes() -> None:
    p = NEXO_PROFILE
    assert p.name == "nexo"
    assert p.display_name == "Coordinador"
    assert p.source_label == "Coordinador · nexo (Citus DB)"
    assert p.tool_prefix == "coordinador_"
    assert "coordinador" in p.router_keywords
    assert "mintral" in p.router_keywords
    assert p.tenant_lock == "mintral"
    assert (
        p.tenant_refusal_template.format(
            display_name=p.display_name, lock=p.tenant_lock
        )
        == "Coordinador is mintral-only. I can't answer for other tenants."
    )
    assert p.freshness_warn_minutes == 30
    assert p.freshness_refuse_minutes == 240


@pytest.mark.asyncio
async def test_boot_without_dsn_returns_disabled() -> None:
    provider = NexoProvider()
    settings = HarnessSettings(datasource_dsn=None)
    result = await provider.boot(ToolRegistry(), settings)
    assert result.enabled is False
    assert result.registered == ()
    assert result.reason is not None
    await provider.close()  # no-op when never connected; must not raise


@pytest.mark.asyncio
async def test_boot_pool_failure_returns_disabled_and_no_leak(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _boom(*args: object, **kwargs: object) -> None:
        raise RuntimeError("connection refused")

    monkeypatch.setattr(
        "miot_harness.integrations.nexo.provider.create_nexo_pool", _boom
    )
    provider = NexoProvider()
    result = await provider.boot(
        ToolRegistry(), HarnessSettings(datasource_dsn="postgresql://u:p@h:5/db")
    )
    assert result.enabled is False
    assert "connection refused" in (result.reason or "")
    assert provider._pool is None  # no leaked half-created pool
