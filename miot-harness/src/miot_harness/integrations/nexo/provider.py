"""Nexo: the first DataSourceProvider (Citus/Postgres, Coordinador schema).

This package is the ONLY place in the harness allowed to say
"Nexo", "Coordinador", or "mintral".
"""

from __future__ import annotations

import logging

import asyncpg

from miot_harness.config import HarnessSettings
from miot_harness.datasource.provider import (
    BootResult,
    DataSourceProfile,
    DataSourceProvider,
)
from miot_harness.integrations.nexo.boot import load_nexo_tools
from miot_harness.integrations.nexo.pool import create_nexo_pool
from miot_harness.integrations.nexo.primer import COORDINADOR_PRIMER
from miot_harness.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

NEXO_PROFILE = DataSourceProfile(
    name="nexo",
    display_name="Coordinador",
    source_label="Coordinador · nexo (Citus DB)",
    tool_prefix="coordinador_",
    primer=COORDINADOR_PRIMER,
    router_keywords=frozenset(
        {
            "coordinador",
            "mintral",
            "centro de control",
            "cola crítica",
            "cola critica",
            "dimensionamiento",
            "torre de control",
            "auditoría pod",
            "auditoria pod",
            "fn_dx",
        }
    ),
    tenant_lock="mintral",
    tenant_refusal_template=(
        "{display_name} is {lock}-only. I can't answer for other tenants."
    ),
    freshness_warn_minutes=30,
    freshness_refuse_minutes=240,
)


class NexoProvider(DataSourceProvider):
    profile = NEXO_PROFILE

    def __init__(self) -> None:
        self._pool: asyncpg.Pool | None = None

    async def boot(
        self, registry: ToolRegistry, settings: HarnessSettings
    ) -> BootResult:
        dsn = settings.nexo_dsn  # renamed to datasource_dsn in a later task
        if dsn is None:
            return BootResult(
                enabled=False,
                registered=(),
                reason="MIOT_HARNESS_NEXO_DSN is not set",
            )
        try:
            self._pool = await create_nexo_pool(
                dsn, application_name=settings.nexo_application_name
            )
            legacy = await load_nexo_tools(registry, settings=settings, pool=self._pool)
        except Exception as exc:  # noqa: BLE001 — boot must not die (base-class contract)
            logger.critical("Nexo: boot failed (%s)", exc)
            await self.close()
            return BootResult(
                enabled=False, registered=(), reason=f"boot failed: {exc}"
            )
        return BootResult(
            enabled=legacy.enabled,
            registered=tuple(legacy.registered),
            reason=legacy.reason,
            snapshot_age_minutes=legacy.snapshot_age_minutes,
        )

    async def close(self) -> None:
        if self._pool is not None:
            try:
                await self._pool.close()
            except Exception as exc:  # noqa: BLE001
                logger.warning("Nexo: pool close raised %s", exc)
            self._pool = None
