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
from dataclasses import replace
from functools import partial
from pathlib import Path

import asyncpg

from miot_harness.config import HarnessSettings
from miot_harness.connections.models import Connection
from miot_harness.datasource.knowledge.learned import approved_cards, with_overlay
from miot_harness.datasource.knowledge.loader import (
    connection_cards_dir,
    detect_packs,
    load_packs,
    probe_version,
)
from miot_harness.datasource.knowledge.models import DetectedPack, KnowledgeCard
from miot_harness.datasource.pool import ENVELOPES, create_pg_pool
from miot_harness.datasource.provider import (
    BootResult,
    DataSourceProfile,
    DataSourceProvider,
)
from miot_harness.datasource.routine_introspect import introspect_routines
from miot_harness.datasource.safe_query import DEFAULT_STATEMENT_TIMEOUT_MS, fetch_readonly
from miot_harness.datasource.safe_sql import HARD_LIMIT_CAP
from miot_harness.datasource.schema_introspect import SchemaSummary, introspect_schema
from miot_harness.datasource.sql_policy import SchemaAllowlistPolicy
from miot_harness.integrations.generic_pg.primitive_tools import build_generic_tools
from miot_harness.runtime.context import HarnessContext
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
    tenant_lock=None,
    tenant_refusal_template=("{display_name} is {lock}-only. I can't answer for other tenants."),
    freshness_warn_minutes=0,
    freshness_refuse_minutes=0,
    has_freshness_model=False,
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


async def workflow_schema(
    pool: object, summary: SchemaSummary | None, statement_timeout_ms: int
) -> str | None:
    """The schema holding the BPMN engine's process definitions, if visible.

    `summary.tables` is capped, so a table past the cap is looked up directly.
    """
    if summary is None or "act_re_procdef" not in summary.all_table_names:
        return None
    for table in summary.tables:
        if table.name == "act_re_procdef":
            return table.schema
    if len(summary.schemas) == 1:
        return summary.schemas[0]
    try:
        rows = await fetch_readonly(
            pool,
            "SELECT table_schema FROM information_schema.tables "
            "WHERE table_name = 'act_re_procdef' AND table_schema = ANY($1::text[]) "
            "ORDER BY table_schema LIMIT 1",
            list(summary.schemas),
            statement_timeout_ms=statement_timeout_ms,
        )
    except Exception as exc:  # noqa: BLE001 — the workflow tool is optional
        logger.warning("generic_pg %s: workflow schema lookup failed (%s)", summary.connection, exc)
        return None
    return str(rows[0]["table_schema"]) if rows else None


def _run_cards(
    cards_dir: Path, connection: str, ctx: HarnessContext
) -> tuple[KnowledgeCard, ...]:
    """The approved authored cards a run sees: with its knowledge overlay."""
    return with_overlay(approved_cards(cards_dir), connection, ctx.knowledge_overlay)


def _workspace_dir(connection: Connection) -> Path | None:
    """Where the agent keeps notes and saved analyses: next to the connection file.

    Synthesized and legacy connections have no file, so they get no workspace.
    """
    source_path = connection.source_path
    if not source_path or source_path.startswith("<"):
        return None
    return Path(source_path).parent


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
            envelope = str(opts.get("envelope", "transaction"))
            if envelope not in ENVELOPES:
                raise ValueError(f"envelope must be one of {ENVELOPES}")
            call_security_definer = opts.get("call_security_definer", False)
            if not isinstance(call_security_definer, bool):
                raise ValueError("call_security_definer must be true or false")
        except (TypeError, ValueError) as exc:
            return BootResult(
                enabled=False, registered=(), reason=f"connection {name!r}: invalid option ({exc})"
            )
        if not schemas:
            return BootResult(
                enabled=False,
                registered=(),
                reason=(
                    f"connection {name!r}: no schemas (set options.schemas or options.search_path)"
                ),
            )

        tenant_lock = _resolve_tenant_lock(opts)
        if tenant_lock is None and connection.scope == "tenant" and connection.tenant_id:
            # A connection file under tenants/<id>/ serves that tenant only.
            tenant_lock = connection.tenant_id
        source_label = str(opts.get("source_label") or name)
        tool_prefix = f"{name}_"
        policy = SchemaAllowlistPolicy(schemas)
        self._profile = DataSourceProfile(
            name=name,
            display_name=source_label,
            source_label=source_label,
            tool_prefix=tool_prefix,
            primer=connection.primer,
            tenant_lock=tenant_lock,
            tenant_refusal_template=(
                "{display_name} is {lock}-only. I can't answer for other tenants."
            ),
            freshness_warn_minutes=0,
            freshness_refuse_minutes=0,
            has_freshness_model=False,
        )

        application_name = str(opts["application_name"]) if opts.get("application_name") else None
        schema_summary = None
        detected: tuple[DetectedPack, ...] = ()
        try:
            self._pool = await create_pg_pool(
                connection.dsn,
                application_name=application_name,
                envelope=envelope,
                statement_timeout_ms=statement_timeout_ms,
            )
            # Introspect first (best-effort): the schema index AND knowledge-pack
            # fingerprinting both need the table set. A failure here must not
            # disable the connection — the query tools still register.
            if settings.generic_schema_introspect_enabled:
                try:
                    schema_summary = await introspect_schema(
                        pool=self._pool,
                        policy=policy,
                        connection=name,
                        max_tables=settings.generic_schema_max_tables,
                        primer=connection.primer,
                        statement_timeout_ms=statement_timeout_ms,
                    )
                except Exception as exc:  # noqa: BLE001 — index is best-effort
                    logger.error(
                        "generic_pg %s: introspection failed (%s); continuing",
                        name,
                        exc,
                        exc_info=True,  # keep the traceback for catalog/permission diag
                    )
                if schema_summary is not None:
                    try:
                        catalog = await introspect_routines(
                            pool=self._pool,
                            policy=policy,
                            limit=1,
                            statement_timeout_ms=statement_timeout_ms,
                        )
                        schema_summary = replace(schema_summary, routine_count=catalog.total)
                    except Exception as exc:  # noqa: BLE001 — count is best-effort
                        logger.error(
                            "generic_pg %s: routine survey failed (%s); continuing",
                            name,
                            exc,
                        )
            # Detect knowledge packs (best-effort) from the full table set.
            knowledge_cards: list[KnowledgeCard] = []
            if schema_summary is not None and settings.generic_knowledge_packs_enabled:
                try:
                    detected = await self._detect_packs(
                        schema_summary,
                        settings=settings,
                        schemas=schema_summary.schemas,
                        statement_timeout_ms=statement_timeout_ms,
                    )
                    knowledge_cards = [c for dp in detected for c in dp.pack.cards]
                except Exception as exc:  # noqa: BLE001 — packs are best-effort
                    logger.error(
                        "generic_pg %s: pack detection failed (%s); continuing",
                        name,
                        exc,
                        exc_info=True,  # keep the traceback for catalog/permission diag
                    )

            # Connection-scoped AUTHORED cards are read from disk on each tool
            # call (not here), so a card approved after boot needs no restart.
            cards_dir = (
                connection_cards_dir(connection)
                if settings.generic_connection_cards_enabled
                else None
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
                knowledge_cards=knowledge_cards,
                authored_cards=(
                    partial(_run_cards, cards_dir, connection.name)
                    if cards_dir is not None
                    else None
                ),
                call_security_definer=call_security_definer,
                workspace_dir=_workspace_dir(connection),
                workflow_schema=await workflow_schema(
                    self._pool, schema_summary, statement_timeout_ms
                ),
            )
            registered: list[str] = []
            for tool in tools:
                registry.register(tool)
                registered.append(tool.name)
        except Exception as exc:  # noqa: BLE001 — boot must not die (base-class contract)
            logger.critical("generic_pg %s: boot failed (%s)", name, exc)
            await self.close()
            return BootResult(enabled=False, registered=(), reason=f"boot failed: {exc}")

        return BootResult(
            enabled=True,
            registered=tuple(registered),
            schema_summary=schema_summary,
            detected_packs=detected,
        )

    async def _detect_packs(
        self,
        summary: SchemaSummary,
        *,
        settings: HarnessSettings,
        schemas: tuple[str, ...],
        statement_timeout_ms: int,
    ) -> tuple[DetectedPack, ...]:
        result = load_packs(settings.knowledge_packs_dir)
        for diag in result.diagnostics:
            logger.warning("knowledge packs: %s", diag)
        matched = detect_packs(summary.all_table_names, result.packs)
        out: list[DetectedPack] = []
        for pack in matched:
            version = None
            if pack.version_probe is not None and self._pool is not None:
                try:
                    version = await probe_version(
                        pool=self._pool,
                        probe=pack.version_probe,
                        schemas=schemas,
                        statement_timeout_ms=statement_timeout_ms,
                    )
                except Exception as exc:  # noqa: BLE001 — probe is best-effort
                    logger.warning("knowledge pack %s: version probe failed (%s)", pack.id, exc)
            out.append(DetectedPack(pack=pack, version=version))
        return tuple(out)

    async def close(self) -> None:
        if self._pool is not None:
            try:
                await self._pool.close()
            except Exception as exc:  # noqa: BLE001
                logger.warning("generic_pg: pool close raised %s", exc)
            self._pool = None
