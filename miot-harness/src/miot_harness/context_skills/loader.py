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

    playbooks: list[LoadedSkill] = []
    connectors: list[LoadedSkill] = []
    for loaded in skill_result.skills:
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
