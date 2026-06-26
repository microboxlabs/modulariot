"""Nexo: the first DataSourceProvider (Citus/Postgres, Coordinador schema).

This package is the ONLY place in the harness allowed to say
"Nexo", "Coordinador", or "mintral".
"""

from __future__ import annotations

import logging

import asyncpg

from miot_harness.config import HarnessSettings
from miot_harness.connections.models import Connection
from miot_harness.datasource.provider import (
    BootResult,
    DataSourceProfile,
    DataSourceProvider,
)
from miot_harness.integrations.nexo.boot import load_nexo_tools
from miot_harness.integrations.nexo.pool import create_nexo_pool
from miot_harness.integrations.nexo.primer import COORDINADOR_PRIMER
from miot_harness.integrations.nexo.primitive_tools import build_primitive_tools
from miot_harness.integrations.nexo.settings import NexoSettings
from miot_harness.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def _resolve_minutes(*candidates: int | None) -> int:
    """First non-None freshness-minutes value (explicit 0 is honored). The
    last candidate is always the profile default (an int), so this returns."""
    for c in candidates:
        if c is not None:
            return int(c)
    return 0


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
        self,
        registry: ToolRegistry,
        settings: HarnessSettings,
        connection: Connection | None = None,
    ) -> BootResult:
        # Connection options (when booted from the connections subsystem) win
        # field-by-field over the legacy MIOT_HARNESS_DATASOURCE_* env, which in
        # turn falls back to the NEXO profile default. With the synthesized /
        # default-file connection these resolve to exactly the legacy values,
        # so behaviour is unchanged.
        opts = dict(connection.options) if connection is not None else {}
        dsn = connection.dsn if connection is not None else settings.datasource_dsn
        if dsn is None:
            reason = (
                "MIOT_HARNESS_DATASOURCE_DSN is not set"
                if connection is None
                else f"connection {connection.name!r}: no DSN (dsn_env unset)"
            )
            return BootResult(enabled=False, registered=(), reason=reason)
        # The schema / EXPLAIN cost knobs are honestly Nexo's (Postgres
        # concepts), so they stay in NexoSettings (MIOT_HARNESS_NEXO_* prefix).
        nexo_settings = NexoSettings()
        tenant_lock = (
            opts.get("tenant_lock")
            or settings.datasource_tenant_lock
            or self.profile.tenant_lock
        )
        assert tenant_lock is not None  # NEXO_PROFILE.tenant_lock is "mintral"
        refuse_minutes = _resolve_minutes(
            opts.get("freshness_refuse_minutes"),
            settings.datasource_freshness_refuse_minutes,
            self.profile.freshness_refuse_minutes,
        )
        warn_minutes = _resolve_minutes(
            opts.get("freshness_warn_minutes"),
            settings.datasource_freshness_warn_minutes,
            self.profile.freshness_warn_minutes,
        )
        application_name = (
            opts.get("application_name") or settings.datasource_application_name
        )
        try:
            self._pool = await create_nexo_pool(
                dsn, application_name=application_name
            )
            legacy = await load_nexo_tools(
                registry,
                schema=nexo_settings.nexo_search_path,
                tenant_lock=tenant_lock,
                refuse_minutes=refuse_minutes,
                pool=self._pool,
                warn_minutes=warn_minutes,
                survey_enabled=settings.datasource_freshness_survey_enabled,
            )
        except Exception as exc:  # noqa: BLE001 — boot must not die (base-class contract)
            logger.critical("Nexo: boot failed (%s)", exc)
            await self.close()
            return BootResult(
                enabled=False, registered=(), reason=f"boot failed: {exc}"
            )
        registered = list(legacy.registered)
        if legacy.enabled:
            # Composable primitives (agentic executor surface). They share
            # the registry but stay invisible to canned mode — the
            # filter_expert catalog filters by the curated tool prefix.
            try:
                for tool in build_primitive_tools(
                    pool=self._pool,
                    schema=nexo_settings.nexo_search_path,
                    tenant_lock=tenant_lock,
                    explain_cost_threshold=nexo_settings.nexo_explain_cost_threshold,
                    source_label=self.profile.source_label,
                ):
                    registry.register(tool)
                    registered.append(tool.name)
            except Exception as exc:  # noqa: BLE001 — curated tools still work without primitives
                logger.error("Nexo: failed to register primitives (%s); continuing", exc)
        return BootResult(
            enabled=legacy.enabled,
            registered=tuple(registered),
            reason=legacy.reason,
            snapshot_age_minutes=legacy.snapshot_age_minutes,
            freshness=dict(legacy.freshness),
            catalog_entries=tuple(legacy.catalog_entries),
        )

    async def close(self) -> None:
        if self._pool is not None:
            try:
                await self._pool.close()
            except Exception as exc:  # noqa: BLE001
                logger.warning("Nexo: pool close raised %s", exc)
            self._pool = None
