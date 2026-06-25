"""Skill invocation: an activated skill's body is injected as run guidance."""

from __future__ import annotations

from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from miot_harness.context_skills.registry import ContextSkillsBundle
from miot_harness.context_skills.skill_models import LoadedSkill, PlaybookSkill
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.router import IntentRouter
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.storytelling.module import StorytellingModule
from miot_harness.tools.registry import ToolRegistry


def _supervisor(tmp_path: Any, bundle: ContextSkillsBundle | None) -> HarnessSupervisor:
    sup = HarnessSupervisor(
        router=IntentRouter(),
        tools=ToolRegistry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(tmp_path),
        tenant_lock="mintral",
    )
    sup.context_skills = bundle
    return sup


def _bundle() -> ContextSkillsBundle:
    return ContextSkillsBundle(
        playbook_skills=(
            LoadedSkill(
                skill=PlaybookSkill(
                    kind="playbook", id="skill-creator", name="Skill Creator"
                ),
                playbook_body="# Skill Creator\nStep 1: decide what it does.",
                source_path="/w/skills/skill-creator/SKILL.md",
            ),
            LoadedSkill(
                skill=PlaybookSkill(kind="playbook", id="bodyless", name="Bodyless"),
                playbook_body=None,
                source_path="/w/skills/bodyless.yaml",
            ),
        )
    )


def test_inject_skill_prepends_body(tmp_path: Any) -> None:
    sup = _supervisor(tmp_path, _bundle())
    req = UserRequest(message="make one", tenant_id="mintral", skill_id="skill-creator")
    out = sup._inject_skill(req, req.to_context(), [HumanMessage(content="prior")])
    assert isinstance(out[0], SystemMessage)
    assert "Skill Creator" in str(out[0].content)
    assert "Step 1: decide" in str(out[0].content)
    # Existing history is preserved after the injected guidance.
    assert isinstance(out[1], HumanMessage)


def test_inject_skill_unknown_id_is_noop(tmp_path: Any) -> None:
    sup = _supervisor(tmp_path, _bundle())
    req = UserRequest(message="x", tenant_id="mintral", skill_id="nope")
    assert sup._inject_skill(req, req.to_context(), []) == []


def test_inject_skill_bodyless_is_noop(tmp_path: Any) -> None:
    sup = _supervisor(tmp_path, _bundle())
    req = UserRequest(message="x", tenant_id="mintral", skill_id="bodyless")
    assert sup._inject_skill(req, req.to_context(), []) == []


def test_inject_skill_noop_without_skill_id_or_bundle(tmp_path: Any) -> None:
    with_bundle = _supervisor(tmp_path, _bundle())
    req = UserRequest(message="x", tenant_id="mintral")
    assert with_bundle._inject_skill(req, req.to_context(), []) == []

    no_bundle = _supervisor(tmp_path, None)
    req2 = UserRequest(message="x", tenant_id="mintral", skill_id="skill-creator")
    assert no_bundle._inject_skill(req2, req2.to_context(), []) == []
