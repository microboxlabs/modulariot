"""Boot loader for the Nexo integration.

Run from the FastAPI lifespan hook (B7) once the asyncpg pool is up.
Steps:
  1. ACL check — embedded equivalent of `check-harness-role.sql`
     `fn_refresh_direct_leak` MUST be 0; any leak disables Nexo.
  2. Connectivity + freshness — call `nexo.fn_dx_centro_control` and
     verify `refreshed_at_servicios` is within the effective refuse threshold.
  3. Introspect — `pg_proc` query → list[FunctionDescriptor].
  4. Build + register — one `coordinador_*` tool per surviving descriptor.

On any failure, log critical and return `NexoBootResult(enabled=False)`
without raising. The harness has other paths and should not die because
Nexo is misconfigured (review item C4).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import asyncpg

from miot_harness.integrations.nexo.introspect import introspect_nexo_functions
from miot_harness.integrations.nexo.tool_factory import build_nexo_tool
from miot_harness.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

_SCHEMA_NAME_RE = re.compile(r"^[a-z_][a-z0-9_]*$")


@dataclass(frozen=True)
class NexoBootResult:
    enabled: bool
    registered: list[str]
    reason: str | None = None
    snapshot_age_minutes: float | None = None


_ACL_CHECK_SQL = """
SELECT
    (SELECT count(*)
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = $1 AND p.proname LIKE 'fn_refresh_%'
       AND has_function_privilege(current_user, p.oid, 'EXECUTE')
       AND NOT has_function_privilege('public', p.oid, 'EXECUTE')
    ) AS fn_refresh_direct_leak
"""

_CENTRO_CONTROL_PROBE_SQL = """
SELECT * FROM {schema}.fn_dx_centro_control() LIMIT 1
"""


async def load_nexo_tools(
    registry: ToolRegistry,
    *,
    schema: str,
    tenant_lock: str,
    refuse_minutes: int,
    pool: asyncpg.Pool | None,
) -> NexoBootResult:
    """Boot the Nexo tools.

    The provider-private knobs are passed in already resolved:
    ``schema`` from :class:`NexoSettings`, and ``tenant_lock`` /
    ``refuse_minutes`` as the effective values (env override over the
    NEXO profile default), resolved once in :meth:`NexoProvider.boot`.
    """
    if pool is None:
        logger.warning("Nexo: disabled (no asyncpg pool — tunnel may be down)")
        return NexoBootResult(
            enabled=False,
            registered=[],
            reason="No asyncpg pool provided; tunnel/connection unavailable.",
        )

    if not _SCHEMA_NAME_RE.match(schema):
        logger.critical(
            "Nexo: refusing to boot with invalid schema name %r (must match [a-z_][a-z0-9_]*)",
            schema,
        )
        return NexoBootResult(
            enabled=False,
            registered=[],
            reason=f"Invalid schema name: {schema!r}",
        )

    # 1. ACL check — fail-closed if any fn_refresh_* is directly grantable.
    try:
        async with pool.acquire() as conn:
            async with conn.transaction(readonly=True):
                row = await conn.fetchrow(_ACL_CHECK_SQL, schema)
        leak = row["fn_refresh_direct_leak"] if row else None
        if leak is None or leak > 0:
            logger.critical(
                "Nexo: ACL check failed (fn_refresh_direct_leak=%s); disabling integration",
                leak,
            )
            return NexoBootResult(
                enabled=False,
                registered=[],
                reason=(
                    f"ACL regression: fn_refresh_direct_leak={leak}. "
                    "Re-apply the read-only harness reader-role grants."
                ),
            )
    except Exception as exc:  # noqa: BLE001 — boot must not die
        logger.critical("Nexo: ACL check raised %s; disabling integration", exc)
        return NexoBootResult(
            enabled=False,
            registered=[],
            reason=f"ACL check failed: {exc}",
        )

    # 2. Connectivity + freshness probe on centro_control.
    age_minutes: float | None = None
    try:
        async with pool.acquire() as conn:
            async with conn.transaction(readonly=True):
                await conn.execute(f"SET LOCAL search_path TO {schema}, public")
                probe = await conn.fetchrow(_CENTRO_CONTROL_PROBE_SQL.format(schema=schema))
        refreshed_at = _extract_refreshed_at(dict(probe) if probe else {})
        if refreshed_at is None:
            logger.warning("Nexo: centro_control probe returned no refreshed_at; continuing")
        else:
            age_minutes = (datetime.now(UTC) - refreshed_at).total_seconds() / 60
            if age_minutes > refuse_minutes:
                logger.critical(
                    "Nexo: centro_control snapshot is %.0f min old "
                    "(refuse threshold %d). Disabling.",
                    age_minutes,
                    refuse_minutes,
                )
                return NexoBootResult(
                    enabled=False,
                    registered=[],
                    reason=(
                        f"Snapshot stale: refreshed_at age {age_minutes:.0f}min "
                        f"> refuse threshold {refuse_minutes}min."
                    ),
                    snapshot_age_minutes=age_minutes,
                )
    except Exception as exc:  # noqa: BLE001
        logger.critical("Nexo: centro_control probe raised %s; disabling", exc)
        return NexoBootResult(
            enabled=False,
            registered=[],
            reason=f"Connectivity/freshness probe failed: {exc}",
        )

    # 3. Introspect — get the surviving fn_dx_* descriptors.
    try:
        async with pool.acquire() as conn:
            async with conn.transaction(readonly=True):
                descriptors = await introspect_nexo_functions(conn, schema=schema)
    except Exception as exc:  # noqa: BLE001
        logger.critical("Nexo: pg_proc introspection raised %s; disabling", exc)
        return NexoBootResult(
            enabled=False,
            registered=[],
            reason=f"Introspection failed: {exc}",
        )

    # 4. Build + register tools.
    registered: list[str] = []
    for descriptor in descriptors:
        try:
            tool = build_nexo_tool(
                descriptor,
                pool=pool,
                tenant_lock=tenant_lock,
                schema=schema,
            )
            registry.register(tool)
            registered.append(tool.name)
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "Nexo: failed to register tool for %s: %s; skipping",
                descriptor.name,
                exc,
            )

    logger.info("Nexo: enabled — %d tools registered", len(registered))
    return NexoBootResult(
        enabled=True, registered=registered, snapshot_age_minutes=age_minutes
    )


def _extract_refreshed_at(row: dict[str, Any]) -> datetime | None:
    for key, value in row.items():
        if isinstance(key, str) and key.startswith("refreshed_at") and isinstance(value, datetime):
            return value
    return None
