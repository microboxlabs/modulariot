"""Boot-time orchestrator for the Context & Skills subsystem.

`boot_context_skills` loads context + skill material, compiles HTTP
connector skills into HarnessTools and registers them (collision- and
cap-safe), validates playbook tool references, and returns a resolved
`ContextSkillsBundle` plus diagnostics.

Contract (mirrors `DataSourceProvider.boot`): this function MUST NOT
raise on bad content. Every content/operational problem is captured as a
`LoadDiagnostic`; the lifespan logs them and continues serving.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from miot_harness.config import HarnessSettings
from miot_harness.context_skills.connector_factory import build_http_tool
from miot_harness.context_skills.registry import ContextSkillsBundle
from miot_harness.context_skills.registry_kind import (
    resolve_context_source,
    resolve_skill_source,
)
from miot_harness.context_skills.skill_models import (
    HttpConnectorSkill,
    LoadedSkill,
    PlaybookSkill,
)
from miot_harness.context_skills.source import (
    ContextSource,
    LoadDiagnostic,
    SkillSource,
)
from miot_harness.tools.registry import ToolRegistry

# Reserved tool-name prefix for connector skills. Datasource providers
# must not register names under this prefix (their tools use the
# profile's own `tool_prefix`).
_SKILL_PREFIX = "skill_"


@dataclass(frozen=True)
class ContextSkillsBootResult:
    bundle: ContextSkillsBundle
    registered_tools: tuple[str, ...]
    diagnostics: tuple[LoadDiagnostic, ...]


@dataclass(frozen=True)
class ActiveConnections:
    """The connection landscape at boot, used to gate connection-bound skills.

    - `enabled`: names of connections that booted enabled (their tools are
      registered, so a bound playbook's tool refs resolve).
    - `capabilities`: the union of capability flags that are True across the
      enabled connections (a skill's `requires_capability` matches this set).
    - `known`: every configured connection name, enabled or not. Used only to
      tell a likely typo (a binding to a name no connection declares) apart
      from a connection that merely failed to boot / has no DSN.
    """

    enabled: frozenset[str] = frozenset()
    capabilities: frozenset[str] = frozenset()
    known: frozenset[str] = frozenset()

    def eligibility(
        self, *, connection: str | None, requires_capability: str | None
    ) -> tuple[bool, str | None]:
        """Decide whether a skill with this binding is eligible.

        Returns `(eligible, warning)`. `warning` is set only for a binding that
        names a connection no configured connection declares — a likely typo
        worth surfacing. A binding to a known-but-disabled connection, or to an
        unavailable capability, is an expected miss (eligible False, no warning)
        and stays silent.
        """
        if connection is not None and connection not in self.known:
            return False, f"bound to unknown connection {connection!r}"
        if connection is not None and connection not in self.enabled:
            return False, None
        if (
            requires_capability is not None
            and requires_capability not in self.capabilities
        ):
            return False, None
        return True, None


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def _namespaced_name(skill: HttpConnectorSkill) -> str:
    base = _slug(skill.tool_name)
    if skill.scope.kind == "tenant" and skill.scope.tenant_id:
        return f"{_SKILL_PREFIX}{_slug(skill.scope.tenant_id)}_{base}"
    return f"{_SKILL_PREFIX}{base}"


def boot_context_skills(
    registry: ToolRegistry,
    settings: HarnessSettings,
    *,
    context_source: ContextSource | None = None,
    skill_source: SkillSource | None = None,
    active_connections: ActiveConnections | None = None,
) -> ContextSkillsBootResult:
    diagnostics: list[LoadDiagnostic] = []

    context_source = context_source or resolve_context_source(
        settings.context_source_kind, context_dir=settings.context_dir
    )
    skill_source = skill_source or resolve_skill_source(
        settings.skills_source_kind, skills_dir=settings.skills_dir
    )

    context_result = context_source.load()
    skill_result = skill_source.load()
    diagnostics.extend(context_result.diagnostics)
    diagnostics.extend(skill_result.diagnostics)

    eligible = _filter_bound_skills(
        skill_result.skills, active_connections, diagnostics
    )

    playbooks: list[LoadedSkill] = []
    connectors: list[LoadedSkill] = []
    for loaded in eligible:
        (playbooks if isinstance(loaded.skill, PlaybookSkill) else connectors).append(
            loaded
        )

    registered = _register_connectors(
        connectors, registry, settings, diagnostics
    )
    _validate_playbook_tools(playbooks, registry, diagnostics)

    bundle = ContextSkillsBundle(
        contexts=context_result.contexts,
        playbook_skills=tuple(playbooks),
    )
    return ContextSkillsBootResult(
        bundle=bundle,
        registered_tools=tuple(registered),
        diagnostics=tuple(diagnostics),
    )


def _filter_bound_skills(
    skills: tuple[LoadedSkill, ...],
    active: ActiveConnections | None,
    diagnostics: list[LoadDiagnostic],
) -> list[LoadedSkill]:
    """Drop connection-bound skills whose connection/capability isn't active.

    When `active` is None the connection landscape is unknown (e.g. a unit
    test not exercising binding) — gate nothing, preserving prior behaviour.
    An unbound skill (no connection / capability) is always kept.
    """
    if active is None:
        return list(skills)
    kept: list[LoadedSkill] = []
    for loaded in skills:
        skill = loaded.skill
        if skill.connection is None and skill.requires_capability is None:
            kept.append(loaded)
            continue
        ok, warning = active.eligibility(
            connection=skill.connection,
            requires_capability=skill.requires_capability,
        )
        if warning:
            diagnostics.append(
                LoadDiagnostic(
                    loaded.source_path,
                    "warning",
                    f"skill {skill.id!r} {warning}; not loaded",
                )
            )
        if ok:
            kept.append(loaded)
    return kept


def _register_connectors(
    connectors: list[LoadedSkill],
    registry: ToolRegistry,
    settings: HarnessSettings,
    diagnostics: list[LoadDiagnostic],
) -> list[str]:
    registered: list[str] = []
    seen: set[str] = set()
    for loaded in connectors:
        skill = loaded.skill
        assert isinstance(skill, HttpConnectorSkill)
        name = _namespaced_name(skill)
        if name in seen:
            diagnostics.append(
                LoadDiagnostic(
                    loaded.source_path,
                    "warning",
                    f"duplicate connector name {name!r}; keeping the first",
                )
            )
            continue
        if len(registered) >= settings.max_connector_tools:
            diagnostics.append(
                LoadDiagnostic(
                    loaded.source_path,
                    "warning",
                    f"max_connector_tools={settings.max_connector_tools} reached; "
                    f"skipping {name!r}",
                )
            )
            continue
        try:
            tool = build_http_tool(
                skill, name=name, source_label=f"skill:{skill.id}"
            )
            registry.register(tool)
        except (ValueError, RuntimeError) as exc:
            # Unsafe manifest or a name collision with an existing
            # (datasource) tool. Skip it — never crash boot. The name is
            # NOT reserved (see below) so a later valid manifest resolving
            # to the same name still gets a chance.
            diagnostics.append(LoadDiagnostic(loaded.source_path, "error", str(exc)))
            continue
        # Reserve the name only after a successful registration so a failed
        # first candidate doesn't block a valid duplicate.
        registered.append(name)
        seen.add(name)
    return registered


def _validate_playbook_tools(
    playbooks: list[LoadedSkill],
    registry: ToolRegistry,
    diagnostics: list[LoadDiagnostic],
) -> None:
    known = set(registry.names())
    for loaded in playbooks:
        skill = loaded.skill
        assert isinstance(skill, PlaybookSkill)
        missing = [t for t in skill.tools if t not in known]
        if missing:
            diagnostics.append(
                LoadDiagnostic(
                    loaded.source_path,
                    "warning",
                    f"playbook {skill.id!r} references unregistered tools: "
                    f"{', '.join(missing)} (datasource may be disabled)",
                )
            )
