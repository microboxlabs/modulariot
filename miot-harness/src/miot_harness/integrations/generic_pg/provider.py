"""Generic Postgres DataSourceProvider (Tier B safe-query).

Backend ``pg``: a connection-driven, schema-allowlisted, read-only query surface
for ANY Postgres schema — no curated `fn_dx_*` catalog required. Unlike Nexo,
this provider knows nothing domain-specific; everything (schemas, primer, tenant
lock, limits) comes from the `Connection` (its `connection.md`).

Flag-gated OFF by default: a `pg` connection registers query tools only when
BOTH `settings.generic_query_enabled` is true AND the connection declares
`capabilities.generic_query: true`. Otherwise it loads disabled (still visible in
/health) and registers nothing.
"""

from __future__ import annotations

import logging

import asyncpg

from miot_harness.config import HarnessSettings
from miot_harness.connections.models import Connection
from miot_harness.datasource.pool import create_pg_pool
from miot_harness.datasource.provider import (
    BootResult,
    DataSourceProfile,
    DataSourceProvider,
)
from miot_harness.datasource.safe_query import DEFAULT_STATEMENT_TIMEOUT_MS
from miot_harness.datasource.safe_sql import HARD_LIMIT_CAP
from miot_harness.datasource.sql_policy import SchemaAllowlistPolicy
from miot_harness.integrations.generic_pg.primitive_tools import build_generic_tools
from miot_harness.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

_DEFAULT_EXPLAIN_COST_THRESHOLD = 10000.0

# Placeholder profile before boot (the abstract contract requires one). A real
# generic connection's profile is built from its Connection at boot.
_GENERIC_DEFAULT_PROFILE = DataSourceProfile(
    name="generic",
    display_name="Generic",
    source_label="generic (pg)",
    tool_prefix="generic_",
    primer="",
    router_keywords=frozenset(),
    tenant_lock=None,
    tenant_refusal_template=(
        "{display_name} is {lock}-only. I can't answer for other tenants."
    ),
    freshness_warn_minutes=0,
    freshness_refuse_minutes=0,
)


def _resolve_schemas(opts: dict[str, object]) -> frozenset[str]:
    """Allowed schemas from `options.schemas` (list/str), else `search_path`."""
    raw = opts.get("schemas")
    if raw is None:
        sp = opts.get("search_path")
        raw = [sp] if sp else []
    if isinstance(raw, str):
        raw = [raw]
    if not isinstance(raw, (list, tuple)):
        raise ValueError("options.schemas must be a string or list of strings")
    return frozenset(str(s).strip() for s in raw if str(s).strip())


def _resolve_tenant_lock(opts: dict[str, object]) -> str | None:
    if "tenant_lock" not in opts:
        return None
    lock = str(opts.get("tenant_lock") or "").strip()
    return lock or None


class GenericPgProvider(DataSourceProvider):
    def __init__(self) -> None:
        self._pool: asyncpg.Pool | None = None
        self._profile: DataSourceProfile = _GENERIC_DEFAULT_PROFILE

    @property
    def profile(self) -> DataSourceProfile:
        return self._profile

    async def boot(
        self,
        registry: ToolRegistry,
        settings: HarnessSettings,
        connection: Connection | None = None,
    ) -> BootResult:
        if connection is None:
            return BootResult(
                enabled=False,
                registered=(),
                reason="generic_pg requires a connection (no legacy-env path)",
            )
        name = connection.name

        # Flag gating — both must be on, else load disabled with a clear reason.
        if not settings.generic_query_enabled:
            return BootResult(
                enabled=False,
                registered=(),
                reason="generic query disabled (MIOT_HARNESS_GENERIC_QUERY_ENABLED is false)",
            )
        if not connection.capabilities.get("generic_query"):
            return BootResult(
                enabled=False,
                registered=(),
                reason=f"connection {name!r} does not declare capabilities.generic_query",
            )

        if connection.dsn is None:
            return BootResult(
                enabled=False,
                registered=(),
                reason=f"connection {name!r}: no DSN (dsn_env unset)",
            )

        opts = dict(connection.options)
        # Validate options up-front so a misconfiguration surfaces as a clean
        # disabled boot, never an exception out of boot() (base-class contract).
        try:
            schemas = _resolve_schemas(opts)
            max_rows = int(opts.get("max_rows", HARD_LIMIT_CAP))
            statement_timeout_ms = int(
                opts.get("statement_timeout_ms", DEFAULT_STATEMENT_TIMEOUT_MS)
            )
            explain_cost_threshold = float(
                opts.get("explain_cost_threshold", _DEFAULT_EXPLAIN_COST_THRESHOLD)
            )
        except (TypeError, ValueError) as exc:
            return BootResult(
                enabled=False, registered=(), reason=f"connection {name!r}: invalid option ({exc})"
            )
        if not schemas:
            return BootResult(
                enabled=False,
                registered=(),
                reason=(
                    f"connection {name!r}: no schemas "
                    "(set options.schemas or options.search_path)"
                ),
            )

        tenant_lock = _resolve_tenant_lock(opts)
        source_label = str(opts.get("source_label") or name)
        tool_prefix = f"{name}_"
        policy = SchemaAllowlistPolicy(schemas)
        self._profile = DataSourceProfile(
            name=name,
            display_name=source_label,
            source_label=source_label,
            tool_prefix=tool_prefix,
            primer=connection.primer,
            router_keywords=frozenset(),
            tenant_lock=tenant_lock,
            tenant_refusal_template=(
                "{display_name} is {lock}-only. I can't answer for other tenants."
            ),
            freshness_warn_minutes=0,
            freshness_refuse_minutes=0,
        )

        application_name = (
            str(opts["application_name"]) if opts.get("application_name") else None
        )
        try:
            self._pool = await create_pg_pool(
                connection.dsn, application_name=application_name
            )
            tools = build_generic_tools(
                pool=self._pool,
                policy=policy,
                tool_prefix=tool_prefix,
                source_label=source_label,
                tenant_lock=tenant_lock,
                max_rows=max_rows,
                explain_cost_threshold=explain_cost_threshold,
                statement_timeout_ms=statement_timeout_ms,
            )
            registered: list[str] = []
            for tool in tools:
                registry.register(tool)
                registered.append(tool.name)
        except Exception as exc:  # noqa: BLE001 — boot must not die (base-class contract)
            logger.critical("generic_pg %s: boot failed (%s)", name, exc)
            await self.close()
            return BootResult(
                enabled=False, registered=(), reason=f"boot failed: {exc}"
            )

        return BootResult(enabled=True, registered=tuple(registered))

    async def close(self) -> None:
        if self._pool is not None:
            try:
                await self._pool.close()
            except Exception as exc:  # noqa: BLE001
                logger.warning("generic_pg: pool close raised %s", exc)
            self._pool = None
