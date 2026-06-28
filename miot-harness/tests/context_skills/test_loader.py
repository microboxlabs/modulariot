from __future__ import annotations

from miot_harness.config import HarnessSettings
from miot_harness.context_skills.loader import ActiveConnections, boot_context_skills
from miot_harness.context_skills.models import ContextScope
from miot_harness.context_skills.skill_models import (
    HttpConnectorSkill,
    LoadedSkill,
    PlaybookSkill,
)
from miot_harness.context_skills.source import (
    ContextLoadResult,
    ContextSource,
    SkillLoadResult,
    SkillSource,
)
from miot_harness.tools.registry import build_default_registry


class _NoContext(ContextSource):
    def load(self) -> ContextLoadResult:
        return ContextLoadResult()


class _Skills(SkillSource):
    def __init__(self, *skills: LoadedSkill) -> None:
        self._skills = skills

    def load(self) -> SkillLoadResult:
        return SkillLoadResult(skills=self._skills)


def _connector(id: str, tool_name: str) -> LoadedSkill:
    return LoadedSkill(
        skill=HttpConnectorSkill(
            kind="http", id=id, tool_name=tool_name, url="https://api.example/x"
        ),
        source_path=f"{id}.yaml",
    )


def test_connector_registered_and_namespaced() -> None:
    registry = build_default_registry()
    result = boot_context_skills(
        registry,
        HarnessSettings(),
        context_source=_NoContext(),
        skill_source=_Skills(_connector("s", "ping")),
    )
    assert result.registered_tools == ("skill_ping",)
    assert "skill_ping" in registry.names()


def test_duplicate_connector_name_diagnostic_not_crash() -> None:
    registry = build_default_registry()
    result = boot_context_skills(
        registry,
        HarnessSettings(),
        context_source=_NoContext(),
        skill_source=_Skills(_connector("a", "dup"), _connector("b", "dup")),
    )
    assert result.registered_tools == ("skill_dup",)
    assert any("duplicate" in d.message for d in result.diagnostics)


def test_failed_first_connector_does_not_block_valid_duplicate() -> None:
    # Two manifests resolve to the same name `skill_dup`; the first is
    # unsafe (sensitive literal header) and fails to build. The second is
    # valid and must still register — the failed first must not reserve
    # the name.
    bad = LoadedSkill(
        skill=HttpConnectorSkill(
            kind="http", id="a", tool_name="dup", url="https://api.example/x",
            headers={"Authorization": "literal-secret"},
        ),
        source_path="a.yaml",
    )
    good = LoadedSkill(
        skill=HttpConnectorSkill(
            kind="http", id="b", tool_name="dup", url="https://api.example/x"
        ),
        source_path="b.yaml",
    )
    registry = build_default_registry()
    result = boot_context_skills(
        registry,
        HarnessSettings(),
        context_source=_NoContext(),
        skill_source=_Skills(bad, good),
    )
    assert result.registered_tools == ("skill_dup",)
    assert "skill_dup" in registry.names()


def test_max_connector_tools_cap() -> None:
    registry = build_default_registry()
    result = boot_context_skills(
        registry,
        HarnessSettings(max_connector_tools=1),
        context_source=_NoContext(),
        skill_source=_Skills(_connector("a", "one"), _connector("b", "two")),
    )
    assert len(result.registered_tools) == 1
    assert any("max_connector_tools" in d.message for d in result.diagnostics)


def _bound_playbook(
    id: str,
    *,
    connection: str | None = None,
    requires_capability: str | None = None,
    scope: ContextScope | None = None,
) -> LoadedSkill:
    return LoadedSkill(
        skill=PlaybookSkill(
            kind="playbook",
            id=id,
            name=id.upper(),
            connection=connection,
            requires_capability=requires_capability,
            scope=scope or ContextScope(),
        ),
        source_path=f"{id}.yaml",
    )


def _bound_connector(
    id: str, tool_name: str, *, connection: str | None = None
) -> LoadedSkill:
    return LoadedSkill(
        skill=HttpConnectorSkill(
            kind="http",
            id=id,
            tool_name=tool_name,
            url="https://api.example/x",
            connection=connection,
        ),
        source_path=f"{id}.yaml",
    )


def _boot(*skills: LoadedSkill, active: ActiveConnections | None = None):
    return boot_context_skills(
        build_default_registry(),
        HarnessSettings(),
        context_source=_NoContext(),
        skill_source=_Skills(*skills),
        active_connections=active,
    )


def test_eligibility_decisions() -> None:
    active = ActiveConnections(
        enabled=frozenset({"acs"}),
        capabilities=frozenset({"generic_query"}),
        known=frozenset({"acs", "nexo"}),
    )
    # Unbound → eligible.
    assert active.eligibility(connection=None, requires_capability=None) == (True, None)
    # Bound to an enabled connection → eligible.
    assert active.eligibility(connection="acs", requires_capability=None) == (True, None)
    # Bound to a known-but-disabled connection → silent miss.
    assert active.eligibility(connection="nexo", requires_capability=None) == (
        False,
        None,
    )
    # Bound to an unknown connection → warning.
    ok, warn = active.eligibility(connection="typo", requires_capability=None)
    assert ok is False
    assert warn is not None and "typo" in warn
    # Capability present / absent.
    assert active.eligibility(connection=None, requires_capability="generic_query") == (
        True,
        None,
    )
    assert active.eligibility(connection=None, requires_capability="curated") == (
        False,
        None,
    )
    # AND semantics: connection enabled but capability missing → ineligible.
    assert active.eligibility(connection="acs", requires_capability="curated") == (
        False,
        None,
    )


def test_enabled_is_authoritative_when_known_unset() -> None:
    # Copilot footgun: a caller that populates only `enabled` (leaving `known`
    # at its empty default) must NOT see enabled connections treated as unknown.
    active = ActiveConnections(enabled=frozenset({"acs"}))
    assert active.eligibility(connection="acs", requires_capability=None) == (
        True,
        None,
    )
    result = _boot(_bound_playbook("acs-pb", connection="acs"), active=active)
    assert [s.skill.id for s in result.bundle.playbooks_for("any")] == ["acs-pb"]


def test_empty_string_binding_rejected() -> None:
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        PlaybookSkill(kind="playbook", id="x", name="X", connection="")
    with pytest.raises(ValidationError):
        PlaybookSkill(kind="playbook", id="x", name="X", requires_capability="")


def test_bound_playbook_loaded_only_when_connection_enabled() -> None:
    active = ActiveConnections(enabled=frozenset({"acs"}), known=frozenset({"acs"}))
    result = _boot(_bound_playbook("acs-pb", connection="acs"), active=active)
    assert [s.skill.id for s in result.bundle.playbooks_for("any")] == ["acs-pb"]


def test_bound_playbook_dropped_when_connection_disabled() -> None:
    # acs is configured (known) but not enabled this boot — silent miss.
    active = ActiveConnections(enabled=frozenset(), known=frozenset({"acs"}))
    result = _boot(_bound_playbook("acs-pb", connection="acs"), active=active)
    assert result.bundle.playbooks_for("any") == []
    assert not any(d.level == "warning" for d in result.diagnostics)


def test_bound_playbook_unknown_connection_warns_and_drops() -> None:
    active = ActiveConnections(enabled=frozenset({"acs"}), known=frozenset({"acs"}))
    result = _boot(_bound_playbook("typo-pb", connection="nope"), active=active)
    assert result.bundle.playbooks_for("any") == []
    assert any(
        "unknown connection" in d.message and d.level == "warning"
        for d in result.diagnostics
    )


def test_capability_bound_playbook_gated_on_active_capability() -> None:
    active = ActiveConnections(
        enabled=frozenset({"acs"}),
        capabilities=frozenset({"generic_query"}),
        known=frozenset({"acs"}),
    )
    has = _bound_playbook("cap-yes", requires_capability="generic_query")
    lacks = _bound_playbook("cap-no", requires_capability="curated")
    result = _boot(has, lacks, active=active)
    assert [s.skill.id for s in result.bundle.playbooks_for("any")] == ["cap-yes"]


def test_bound_connector_registered_only_when_connection_enabled() -> None:
    active = ActiveConnections(enabled=frozenset({"acs"}), known=frozenset({"acs", "x"}))
    on = _bound_connector("a", "live", connection="acs")
    off = _bound_connector("b", "dark", connection="x")  # known, disabled
    result = boot_context_skills(
        build_default_registry(),
        HarnessSettings(),
        context_source=_NoContext(),
        skill_source=_Skills(on, off),
        active_connections=active,
    )
    assert result.registered_tools == ("skill_live",)


def test_unbound_skill_always_loaded_regardless_of_active_set() -> None:
    active = ActiveConnections(enabled=frozenset(), known=frozenset())
    result = _boot(_bound_playbook("plain"), active=active)
    assert [s.skill.id for s in result.bundle.playbooks_for("any")] == ["plain"]


def test_none_active_set_disables_gating_back_compat() -> None:
    # Callers that don't pass active_connections (older tests) gate nothing,
    # even for a bound skill.
    result = _boot(_bound_playbook("acs-pb", connection="acs"), active=None)
    assert [s.skill.id for s in result.bundle.playbooks_for("any")] == ["acs-pb"]


def test_binding_composes_with_tenant_scope() -> None:
    active = ActiveConnections(enabled=frozenset({"acs"}), known=frozenset({"acs"}))
    pb = _bound_playbook(
        "acs-t",
        connection="acs",
        scope=ContextScope(kind="tenant", tenant_id="mintral"),
    )
    result = _boot(pb, active=active)
    # Eligible for its tenant, absent for others (scope still applies).
    assert [s.skill.id for s in result.bundle.playbooks_for("mintral")] == ["acs-t"]
    assert result.bundle.playbooks_for("other") == []


def test_playbook_unknown_tool_warns() -> None:
    registry = build_default_registry()
    playbook = LoadedSkill(
        skill=PlaybookSkill(
            kind="playbook", id="p", name="P", tools=("does_not_exist",)
        ),
        source_path="p.yaml",
    )
    result = boot_context_skills(
        registry,
        HarnessSettings(),
        context_source=_NoContext(),
        skill_source=_Skills(playbook),
    )
    assert any("unregistered tools" in d.message for d in result.diagnostics)
    # The playbook still loads into the bundle despite the missing tool.
    assert [s.skill.id for s in result.bundle.playbooks_for("any")] == ["p"]
