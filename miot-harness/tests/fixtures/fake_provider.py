"""A minimal second DataSourceProvider.

Exists to prove the seam: core runtime/agent tests run against this
provider so they cannot accidentally depend on Nexo/Coordinador/Mintral
specifics. Mirrors the eval-stub tool shape used by run_golden.py.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel

from miot_harness.config import HarnessSettings
from miot_harness.connections.models import Connection
from miot_harness.datasource.provider import (
    BootResult,
    DataSourceProfile,
    DataSourceProvider,
)
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool
from miot_harness.tools.registry import ToolRegistry

FAKE_PROFILE = DataSourceProfile(
    name="fake",
    display_name="FakeSource",
    source_label="FakeSource · fake (test)",
    tool_prefix="fake_",
    primer="FakeSource is a synthetic datasource used in harness tests.",
    router_keywords=frozenset({"fakesource", "fixture"}),
    tenant_lock="acme",
    tenant_refusal_template=(
        "{display_name} is {lock}-only. I can't answer for other tenants."
    ),
    freshness_warn_minutes=30,
    freshness_refuse_minutes=240,
)


class _In(BaseModel):
    pass


class _Out(BaseModel):
    rows: list[dict[str, Any]] = []
    refreshed_at: datetime | None = None
    source: str = FAKE_PROFILE.source_label


async def _check(ctx: HarnessContext, inp: BaseModel) -> PermissionResult:
    if ctx.tenant_id != FAKE_PROFILE.tenant_lock:
        return PermissionResult.deny("FakeSource is acme-only")
    return PermissionResult.allow()


async def _call(
    ctx: HarnessContext, inp: BaseModel, progress: Callable[..., None]
) -> _Out:
    now = datetime.now(UTC)
    return _Out(rows=[{"value": 42}], refreshed_at=now)


class FakeProvider(DataSourceProvider):
    profile = FAKE_PROFILE

    async def boot(
        self,
        registry: ToolRegistry,
        settings: HarnessSettings,
        connection: Connection | None = None,
    ) -> BootResult:
        registry.register(
            HarnessTool(
                name="fake_lookup",
                description="[Layer L1] fake test tool",
                input_model=_In,
                output_model=_Out,
                check_permission=_check,
                call=_call,
            )
        )
        return BootResult(enabled=True, registered=("fake_lookup",))

    async def close(self) -> None:
        return None
