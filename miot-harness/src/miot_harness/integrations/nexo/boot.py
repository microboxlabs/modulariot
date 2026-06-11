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

import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime

import asyncpg

from miot_harness.agents.meta_agent import MetaAgentCatalogEntry
from miot_harness.datasource.provider import FreshnessProbe
from miot_harness.integrations.nexo.freshness import survey_freshness
from miot_harness.integrations.nexo.introspect import (
    FunctionDescriptor,
    introspect_nexo_functions,
)
from miot_harness.integrations.nexo.tool_factory import build_nexo_tool, freshest_refreshed_at
from miot_harness.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

_SCHEMA_NAME_RE = re.compile(r"^[a-z_][a-z0-9_]*$")


@dataclass(frozen=True)
class NexoBootResult:
    enabled: bool
    registered: list[str]
    reason: str | None = None
    snapshot_age_minutes: float | None = None
    # Per-function freshness survey + descriptor-derived meta catalog
    # (Gap 2). Empty when the survey is disabled or boot fails early.
    freshness: dict[str, FreshnessProbe] = field(default_factory=dict)
    catalog_entries: list[MetaAgentCatalogEntry] = field(default_factory=list)


def _freshness_suffix(probe: FreshnessProbe | None) -> str:
    if probe is None or probe.status == "skipped":
        return ""
    if probe.status in ("fresh", "stale"):
        refreshed = probe.refreshed_at.strftime("%H:%M UTC") if probe.refreshed_at else "?"
        age = f"hace {probe.age_minutes:.0f} min" if probe.age_minutes is not None else "?"
        return f"Último refresh: {refreshed} ({age})."
    if probe.status == "empty":
        return "Snapshot vigente sin filas para los filtros por defecto."
    if probe.status == "no_timestamp":
        return "Snapshot con datos pero sin marca de tiempo de actualización."
    if probe.status == "empty_no_timestamp":
        return "Snapshot sin datos ni marca de tiempo — posiblemente sin refrescar."
    return "No fue posible sondear el estado del snapshot."


def _catalog_entry(
    descriptor: FunctionDescriptor,
    tool_name: str,
    probe: FreshnessProbe | None,
) -> MetaAgentCatalogEntry:
    parsed = descriptor.description
    layer = parsed.layer if parsed.layer in {"L1", "L2", "L3", "VT"} else ""
    if not layer:
        layer = parsed.meta.get("layer", "").strip() or "L*"
    body = parsed.body.strip() or f"Curated function `{descriptor.name}`."
    title = parsed.title.strip() or body.splitlines()[0][:80]
    suffix = _freshness_suffix(probe)
    if suffix:
        body = f"{body}\n  {suffix}"
    return MetaAgentCatalogEntry(name=tool_name, layer=layer, title=title, body=body)


_ACL_CHECK_SQL = """
SELECT
    (SELECT count(*)
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = $1 AND p.proname LIKE 'fn_refresh_%'
       AND has_function_privilege(current_user, p.oid, 'EXECUTE')
       AND NOT has_function_privilege('public', p.oid, 'EXECUTE')
    ) AS fn_refresh_direct_leak
"""

# Multi-layer probe: centro_control returns one row PER LAYER (servicios,
# torre, …), each with its own refreshed_at_*, and row order is not
# guaranteed. Fetch a bounded set and gate on the FRESHEST timestamp —
# LIMIT 1 flips between layers across boots and a single stale layer
# would flakily disable the whole integration.
_CENTRO_CONTROL_PROBE_SQL = """
SELECT * FROM {schema}.fn_dx_centro_control() LIMIT 50
"""


async def load_nexo_tools(
    registry: ToolRegistry,
    *,
    schema: str,
    tenant_lock: str,
    refuse_minutes: int,
    pool: asyncpg.Pool | None,
    warn_minutes: int = 30,
    survey_enabled: bool = True,
    probe_attempts: int = 3,
    probe_retry_delay_s: float = 2.0,
) -> NexoBootResult:
    """Boot the Nexo tools.

    The provider-private knobs are passed in already resolved:
    ``schema`` from :class:`NexoSettings`, and ``tenant_lock`` /
    ``refuse_minutes`` / ``warn_minutes`` as the effective values (env
    override over the NEXO profile default), resolved once in
    :meth:`NexoProvider.boot`.
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

    # 2. Connectivity + freshness probe on centro_control. The refresh job
    # briefly NULLs the freshest layer timestamp while rebuilding, so a
    # single point-in-time probe can land in that window and flakily
    # report only a stale layer — retry before refusing.
    age_minutes: float | None = None
    try:
        for attempt in range(1, probe_attempts + 1):
            async with pool.acquire() as conn:
                async with conn.transaction(readonly=True):
                    await conn.execute(f"SET LOCAL search_path TO {schema}, public")
                    probe_rows = await conn.fetch(
                        _CENTRO_CONTROL_PROBE_SQL.format(schema=schema)
                    )
            refreshed_at = freshest_refreshed_at(
                [dict(r) for r in probe_rows] if probe_rows else []
            )
            if refreshed_at is None:
                age_minutes = None
            else:
                age_minutes = (datetime.now(UTC) - refreshed_at).total_seconds() / 60
                if age_minutes <= refuse_minutes:
                    break  # fresh enough — gate passes
            if attempt < probe_attempts:
                logger.warning(
                    "Nexo: centro_control probe attempt %d/%d saw %s; retrying",
                    attempt,
                    probe_attempts,
                    "no refreshed_at" if age_minutes is None else f"age {age_minutes:.0f}min",
                )
                await asyncio.sleep(probe_retry_delay_s)
        if age_minutes is None:
            logger.warning("Nexo: centro_control probe returned no refreshed_at; continuing")
        elif age_minutes > refuse_minutes:
            logger.critical(
                "Nexo: centro_control snapshot is %.0f min old "
                "(refuse threshold %d, %d attempts). Disabling.",
                age_minutes,
                refuse_minutes,
                probe_attempts,
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

    # 3.5. Per-function freshness survey (Gap 2). Failures never disable
    # the integration — an unprobeable function reports status="error".
    freshness: dict[str, FreshnessProbe] = {}
    if survey_enabled:
        try:
            freshness = await survey_freshness(
                pool, schema=schema, descriptors=descriptors, warn_minutes=warn_minutes
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Nexo: freshness survey raised %s; continuing without it", exc)

    # 4. Build + register tools (+ descriptor-derived meta catalog).
    registered: list[str] = []
    catalog_entries: list[MetaAgentCatalogEntry] = []
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
            catalog_entries.append(
                _catalog_entry(descriptor, tool.name, freshness.get(descriptor.name))
            )
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "Nexo: failed to register tool for %s: %s; skipping",
                descriptor.name,
                exc,
            )

    logger.info("Nexo: enabled — %d tools registered", len(registered))
    return NexoBootResult(
        enabled=True,
        registered=registered,
        snapshot_age_minutes=age_minutes,
        freshness=freshness,
        catalog_entries=catalog_entries,
    )
