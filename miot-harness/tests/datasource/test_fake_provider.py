from __future__ import annotations

import pytest

from miot_harness.config import HarnessSettings
from miot_harness.tools.registry import ToolRegistry
from tests.fixtures.fake_provider import FAKE_PROFILE, FakeProvider


@pytest.mark.asyncio
async def test_fake_provider_boots_and_registers_tools() -> None:
    provider = FakeProvider()
    registry = ToolRegistry()
    result = await provider.boot(registry, HarnessSettings())
    assert result.enabled is True
    assert result.registered == ("fake_lookup",)
    assert "fake_lookup" in registry.names()
    assert provider.profile is FAKE_PROFILE
    await provider.close()
