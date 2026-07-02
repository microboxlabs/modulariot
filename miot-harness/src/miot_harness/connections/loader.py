"""Boot-time connection loader.

`load_connections` resolves the list of connections the lifespan should boot:
the file-backed definitions, or — for transition safety, when no connection
files are present yet — a single connection synthesized from the legacy
`MIOT_HARNESS_DATASOURCE_*` env so existing deployments keep working with no
authored file.

`select_primary` picks the connection whose provider drives the
profile/router/tenant-lock wiring (the configured `datasource_kind`, else the
first) — preserving today's single-datasource behaviour.
"""

from __future__ import annotations

from miot_harness.config import HarnessSettings
from miot_harness.connections.file_source import FileConnectionSource
from miot_harness.connections.models import (
    Connection,
    ConnectionDiagnostic,
    ConnectionLoadResult,
)
from miot_harness.connections.source import ConnectionSource


def _synthesize_from_legacy_env(settings: HarnessSettings) -> Connection | None:
    """Build one connection from the legacy `MIOT_HARNESS_DATASOURCE_*` env.

    Returns None when no DSN is configured (the dev no-datasource / B2 mode):
    in that case there is simply no connection, and readiness stays green with
    `tools: []` exactly as before."""
    if settings.datasource_dsn is None:
        return None
    options: dict[str, object] = {
        "application_name": settings.datasource_application_name,
    }
    if settings.datasource_tenant_lock is not None:
        options["tenant_lock"] = settings.datasource_tenant_lock
    if settings.datasource_freshness_warn_minutes is not None:
        options["freshness_warn_minutes"] = settings.datasource_freshness_warn_minutes
    if settings.datasource_freshness_refuse_minutes is not None:
        options["freshness_refuse_minutes"] = (
            settings.datasource_freshness_refuse_minutes
        )
    return Connection(
        name=settings.datasource_kind,
        backend=settings.datasource_kind,
        dsn=settings.datasource_dsn,
        options=options,
        primer="",
        source_path="<legacy-env>",
    )


def load_connections(
    settings: HarnessSettings,
    *,
    source: ConnectionSource | None = None,
) -> ConnectionLoadResult:
    """Load connections from files, falling back to legacy-env synthesis when
    no files are found. Never raises (mirrors the source contract)."""
    source = source or FileConnectionSource(settings.connections_dir)
    result = source.load()

    if result.connections:
        return result

    # Connection files WERE discovered but every one was rejected (error-level
    # diagnostics). Do NOT silently boot the legacy synthesized datasource — that
    # would mask a broken rollout and could keep the pod pointed at stale
    # settings. Surface the failure instead; the fallback below is only for the
    # genuine "no connection files present" transition case (where the source
    # emits at most a 'dir does not exist' warning, never an error).
    if any(d.level == "error" for d in result.diagnostics):
        return ConnectionLoadResult((), tuple(result.diagnostics))

    # No connection files → transition fallback to the legacy single-datasource
    # env. Keep the source's diagnostics (e.g. "dir does not exist") so the
    # operator sees why we fell back.
    diagnostics = list(result.diagnostics)
    synthesized = _synthesize_from_legacy_env(settings)
    if synthesized is None:
        return ConnectionLoadResult((), tuple(diagnostics))
    diagnostics.append(
        ConnectionDiagnostic(
            "<legacy-env>",
            "warning",
            "no connection files found; synthesized one connection from "
            "MIOT_HARNESS_DATASOURCE_* env (back-compat).",
        )
    )
    return ConnectionLoadResult((synthesized,), tuple(diagnostics))


def select_primary(
    connections: tuple[Connection, ...], settings: HarnessSettings
) -> Connection | None:
    """The connection that drives profile/router/tenant-lock wiring: the one
    matching the configured `datasource_kind`, else the first, else None."""
    if not connections:
        return None
    for conn in connections:
        if conn.backend == settings.datasource_kind:
            return conn
    return connections[0]
