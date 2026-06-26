"""Connection model + load result types.

A `Connection` is the resolved, in-memory form of one `connection.md`: the
frontmatter config plus the Markdown body (the per-connection primer, consumed
by a later phase). Secrets are never stored here verbatim — the file names the
env var holding the DSN (`dsn_env`) and the loader resolves it at boot, so the
authored file stays secret-free.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Literal

DiagnosticLevel = Literal["error", "warning"]
ConnectionScope = Literal["global", "tenant"]


@dataclass(frozen=True)
class ConnectionDiagnostic:
    """A non-fatal problem found while loading a connection file."""

    path: str
    level: DiagnosticLevel
    message: str


@dataclass(frozen=True)
class Connection:
    """One resolved datasource connection.

    - name:        machine id (slug); also the key in `app.state.connections`.
    - backend:     the DataSourceProvider kind (see `datasource/registry.py`),
                   e.g. "nexo". Resolved to a provider at boot.
    - dsn:         the resolved connection string (from `dsn_env`), or None
                   when the referenced env var is unset — in which case the
                   connection is treated as unconfigured / not-required for
                   readiness (mirrors the legacy `datasource_dsn is None`
                   "datasource disabled" contract).
    - scope/tenant_id: global (default) or tenant-scoped, like skills.
    - options:     provider-specific knobs (e.g. tenant_lock, freshness,
                   application_name). The provider reads what it understands.
    - capabilities:tier flags (curated / generic_query) — stubs consumed by
                   later phases.
    - primer:      the Markdown body — the per-connection grounding text. Carried
                   now; wired into prompts in a later phase.
    - required:    when True (default) and `dsn` is set, the pod is not ready
                   until this connection boots. A connection with no `dsn` is
                   never required regardless of this flag.
    - source_path: provenance for diagnostics.
    """

    name: str
    backend: str
    dsn: str | None
    scope: ConnectionScope = "global"
    tenant_id: str | None = None
    options: Mapping[str, Any] = field(default_factory=dict)
    capabilities: Mapping[str, bool] = field(default_factory=dict)
    primer: str = ""
    required: bool = True
    source_path: str = "<synthesized>"

    @property
    def configured(self) -> bool:
        """True iff a DSN resolved — i.e. the connection can actually boot.

        An unconfigured connection (no `dsn`) is skipped for readiness, exactly
        as a missing `MIOT_HARNESS_DATASOURCE_DSN` disabled the datasource
        before this abstraction existed (keeps the dev no-datasource / B2 mode
        Ready)."""
        return self.dsn is not None

    @property
    def gates_readiness(self) -> bool:
        """True iff this connection must be enabled for the pod to be Ready."""
        return self.required and self.configured


@dataclass(frozen=True)
class ConnectionLoadResult:
    connections: tuple[Connection, ...] = ()
    diagnostics: tuple[ConnectionDiagnostic, ...] = ()
