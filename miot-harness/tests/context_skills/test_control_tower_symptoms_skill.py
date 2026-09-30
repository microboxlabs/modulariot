"""The packaged `control-tower-symptoms` skill loads and offers the symptoms_* tools."""

from __future__ import annotations

from pathlib import Path

import pytest

import miot_harness.context_skills as context_skills_pkg
from miot_harness.config import HarnessSettings
from miot_harness.context_skills.file_source import FileSkillSource
from miot_harness.context_skills.loader import boot_context_skills
from miot_harness.context_skills.mcp_skills import MCP_CALL_TOOL, offers
from miot_harness.context_skills.skill_models import PlaybookSkill
from miot_harness.context_skills.source import ContextLoadResult, ContextSource
from miot_harness.tools.registry import build_default_registry

_SKILLS_DIR = Path(context_skills_pkg.__file__).parent / "defaults" / "skills"
_SKILL = "control-tower-symptoms"
_TOOLS = (
    "symptoms_list",
    "symptoms_get",
    "symptoms_sources",
    "symptoms_validate",
    "symptoms_preview",
    "symptoms_plan_publish",
    "symptoms_save_draft",
    "symptoms_publish",
    "symptoms_rollback",
    "symptoms_set_state",
)


class _NoContext(ContextSource):
    def load(self) -> ContextLoadResult:
        return ContextLoadResult()


def test_the_skill_loads_and_names_the_symptom_tools() -> None:
    result = FileSkillSource(_SKILLS_DIR).load()
    assert not [d for d in result.diagnostics if d.level == "error"]
    loaded = {s.skill.id: s for s in result.skills if isinstance(s.skill, PlaybookSkill)}[_SKILL]
    skill = loaded.skill
    assert isinstance(skill, PlaybookSkill)
    assert skill.mcp is not None
    assert skill.mcp.url == "${MIOT_HARNESS_MODULITH_URL}/api/v1/mcp"
    assert skill.mcp.tools == _TOOLS
    assert not offers(skill.mcp, "selectables_list")
    for tool in _TOOLS:
        assert f"`{tool}`" in (loaded.playbook_body or ""), tool


def test_boot_offers_the_skill_when_the_modulith_is_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MIOT_HARNESS_MODULITH_URL", "http://modulith:8180")
    registry = build_default_registry()

    result = boot_context_skills(
        registry,
        HarnessSettings(),
        context_source=_NoContext(),
        skill_source=FileSkillSource(_SKILLS_DIR),
    )

    assert MCP_CALL_TOOL in registry.names()
    skill = result.bundle.find_mcp_skill("tenant-a", _SKILL)
    assert skill is not None and skill.mcp is not None
    assert skill.mcp.url == "http://modulith:8180/api/v1/mcp"
