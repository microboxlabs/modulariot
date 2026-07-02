"""The datasource seam.

The harness core is datasource-agnostic: it orchestrates agents over a
tool registry, but never names the system the tools come from (a DB, a
filesystem, a cloud API, an MCP server). Everything domain-specific is
supplied by a DataSourceProvider:

- lifecycle (`boot` / `close`): connect, discover capabilities,
  register tools into the shared ToolRegistry;
- a declarative `DataSourceProfile`: every name, prompt, keyword and
  threshold the core needs to speak about the datasource without
  hardcoding it.

Each profile field maps 1:1 to a former hardcode (see
docs/specs/2026-06-05-harness-datasource-refactor-design.md).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from miot_harness.agents.meta_agent import MetaAgentCatalogEntry
    from miot_harness.config import HarnessSettings
    from miot_harness.connections.models import Connection
    from miot_harness.datasource.knowledge.models import DetectedPack
    from miot_harness.datasource.schema_introspect import SchemaSummary
    from miot_harness.tools.registry import ToolRegistry


@dataclass(frozen=True)
class DataSourceProfile:
    """Declarative domain values the core reads instead of hardcoding.

    - name:            machine id (lowercase slug) — /health block, graph
                       label, OTel span prefix.
    - display_name:    human-facing name — agent prompt templating.
    - source_label:    provenance string shown on SSE tool events and
                       evidence rows.
    - tool_prefix:     prefix of tools this datasource registers (e.g.
                       "<slug>_") — used by the filter expert to scope tool
                       selection.
    - primer:          grounding text injected into analyst / synthesizer /
                       meta-agent system prompts.
    - router_keywords: lowercase literals that route a message to the
                       data pipeline (keyword router).
    - tenant_lock:     default tenant the datasource is locked to, or
                       None for no lock. Env-overridable via
                       `datasource_tenant_lock`.
    - tenant_refusal_template: str.format template with {display_name}
                       and {lock} placeholders — the exact user-visible
                       refusal copy.
    - freshness_warn_minutes / freshness_refuse_minutes: snapshot-age
                       SLA defaults. Env-overridable.
    """

    name: str
    display_name: str
    source_label: str
    tool_prefix: str
    primer: str
    router_keywords: frozenset[str]
    tenant_lock: str | None
    tenant_refusal_template: str
    freshness_warn_minutes: int
    freshness_refuse_minutes: int
    # Whether this datasource has a snapshot/refresh freshness model (Nexo's
    # `fn_dx_*` snapshot tables do; a live operational DB does not). When False,
    # the freshness judge is a no-op — a live source with no `refreshed_at` is
    # not "stale", so the snapshot-age warning is suppressed.
    has_freshness_model: bool = True


@dataclass(frozen=True)
class FreshnessProbe:
    """One datasource function's snapshot state at boot time.

    status: fresh | stale | no_timestamp | empty | empty_no_timestamp |
            error | skipped (mirrors DataEvidence.freshness_status, plus
            the survey-only error/skipped outcomes).
    """

    function: str
    refreshed_at: datetime | None
    age_minutes: float | None
    has_rows: bool
    status: str


@dataclass(frozen=True)
class BootResult:
    """Outcome of DataSourceProvider.boot — same shape for every provider."""

    enabled: bool
    registered: tuple[str, ...]
    reason: str | None = None
    # float is intentional: sub-minute precision from timestamp arithmetic
    # (sub-minute precision is required by the freshness SLA checks).
    snapshot_age_minutes: float | None = None
    # Per-function freshness survey (Gap 2): lets /health and the meta
    # agent say which functions are fresh vs stale BEFORE a user asks.
    freshness: dict[str, FreshnessProbe] = field(default_factory=dict)
    # Descriptor-derived meta-agent catalog (title/layer/body + freshness
    # suffix). Empty → the server falls back to generic entries.
    catalog_entries: tuple[MetaAgentCatalogEntry, ...] = ()
    # Connection Knowledge Base (Phase 2): the boot-time schema index for
    # generic connections. None for providers that don't introspect (e.g.
    # Nexo, which surfaces its function catalog instead).
    schema_summary: SchemaSummary | None = None
    # Curated knowledge packs detected for this connection (Phase 2 slice 2).
    detected_packs: tuple[DetectedPack, ...] = ()


class DataSourceProvider(ABC):
    """Lifecycle owner for one datasource.

    Implementations own their connection handles (pool, client, MCP
    session); the harness only calls boot() once from the lifespan and
    close() on shutdown. boot() must not raise for operational failures
    — return BootResult(enabled=False, reason=...) so the harness keeps
    serving non-data routes.
    """

    @property
    @abstractmethod
    def profile(self) -> DataSourceProfile:
        """Return the datasource profile for this provider.

        Subclasses may satisfy this with a plain class attribute
        (``profile = MY_PROFILE``) — Python honours it as the property value.
        """
        ...

    @abstractmethod
    async def boot(
        self,
        registry: ToolRegistry,
        settings: HarnessSettings,
        connection: Connection | None = None,
    ) -> BootResult:
        """Boot the datasource.

        ``connection`` carries the resolved per-connection config (DSN +
        options) when the harness boots from the connections subsystem. It is
        optional and defaults to ``None`` so existing callers/tests that pass
        only ``(registry, settings)`` keep the legacy settings-driven
        behaviour; a provider reads ``connection`` when present and falls back
        to ``settings`` field-by-field otherwise.
        """
        ...

    @abstractmethod
    async def close(self) -> None: ...
