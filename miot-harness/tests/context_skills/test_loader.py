from __future__ import annotations

from miot_harness.config import HarnessSettings
from miot_harness.context_skills.loader import boot_context_skills
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
