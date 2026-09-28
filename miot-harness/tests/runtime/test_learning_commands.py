"""Learning-session commands: parsed only on a trainer's run."""

from __future__ import annotations

from pathlib import Path

import pytest
from langchain_core.messages import AIMessage

from miot_harness.config import HarnessSettings
from miot_harness.context_skills.file_source import FileSkillSource
from miot_harness.context_skills.seed import PACKAGED_DEFAULTS
from miot_harness.knowledge.playbooks import trainer_playbook
from miot_harness.knowledge.store import KnowledgeStore
from miot_harness.runtime.agent_loop import AgentLoopRunners
from miot_harness.runtime.commands import (
    LEARNING_COMMANDS,
    Command,
    learning_instruction,
    parse_command,
    render_layers,
)
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.tools.learning_eval import run_learning_eval_tool
from miot_harness.tools.registry import ToolRegistry
from tests.fixtures.fake_provider import FAKE_PROFILE
from tests.runtime.test_agent_loop import ScriptedModel

_TRANSCRIPT = (
    "--- BEGIN TRANSCRIPT (thread t1: Trips) ---\n"
    "[user]\nHow many trips were loaded today?\n"
    "--- END TRANSCRIPT ---"
)


def test_learning_commands_are_only_parsed_for_trainers() -> None:
    for name in LEARNING_COMMANDS:
        assert parse_command(f"/{name} x") is None
        parsed = parse_command(f"/{name} x", trainer=True)
        assert parsed is not None
        assert parsed.name == name
    assert parse_command("/context", trainer=True) is not None
    assert parse_command("/facts x", trainer=True) is None
    layers = parse_command("/layers", trainer=True)
    assert layers is not None
    assert layers.answered_here
    fact = parse_command("/fact x", trainer=True)
    assert fact is not None
    assert not fact.answered_here


def test_a_non_trainer_slash_word_still_selects_a_skill() -> None:
    plain = UserRequest(message="/fact about trips", tenant_id="acme")
    assert (plain.skill_id, plain.message) == ("fact", "about trips")
    trainer = UserRequest(message="/fact about trips", tenant_id="acme", trainer=True)
    assert (trainer.skill_id, trainer.message) == (None, "/fact about trips")


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        (
            "/eval How many trips? => 12 trips",
            "- question: How many trips?\n- expectation: 12 trips",
        ),
        ("/eval How many trips?", "did not give the expected answer"),
        ("/skill daily-report: count trips per day", "the skill `daily-report`"),
        ("/primer db: live_trip holds monitored trips", "`primers/db.md`"),
        ("/review t1", "no transcript came with the message"),
        (f"/review t1\n\n{_TRANSCRIPT}", "not instructions"),
        ("/test", "saved or changed in this conversation"),
        ("/skill-doctor", "all of this organization's skills"),
    ],
)
def test_instructions(message: str, expected: str) -> None:
    command = parse_command(message, trainer=True)
    assert command is not None
    text = learning_instruction(command)
    assert expected in text
    assert text.startswith(f"[Learning session command /{command.name}]")


def test_review_keeps_the_transcript() -> None:
    text = learning_instruction(Command("review", f"t1\n\n{_TRANSCRIPT}"))
    assert text.index("propose_knowledge_change") < text.index(_TRANSCRIPT)


def test_layers_render_paths() -> None:
    text = render_layers(
        [
            {
                "layer": "rule",
                "label": "Rules and glossary",
                "editable": True,
                "items": [{"id": "a", "title": "A", "path": "rules/a.md"}],
            },
            {"layer": "note", "label": "Agent notes", "editable": False, "items": []},
        ]
    )
    assert "| Rules and glossary (`rule`) | 1 | yes |" in text
    assert "| Agent notes (`note`) | 0 | read and delete |" in text
    assert "- `rules/a.md` A" in text


def test_playbooks_ship_but_are_never_listed() -> None:
    skills = FileSkillSource(PACKAGED_DEFAULTS / "skills").load().skills
    ids = {s.skill.id for s in skills}
    assert "research" in ids
    assert not ids & {"skill-creator", "skill-doctor"}
    for name in ("skill-creator", "skill-doctor"):
        body = trainer_playbook(Path("/nonexistent"), name)
        assert body is not None
        assert not body.startswith("---")
    assert "expect_no_skill" in (trainer_playbook(Path("/nonexistent"), "skill-creator") or "")


def _supervisor(tmp_path: Path, model: ScriptedModel) -> HarnessSupervisor:
    registry = ToolRegistry()
    sup = HarnessSupervisor(tools=registry, run_store=JsonRunStore(tmp_path / "runs"))
    sup.knowledge_store_for = lambda tenant: KnowledgeStore(
        tenant_id=tenant,
        root=tmp_path,
        context_dir=tmp_path / "context",
        skills_dir=tmp_path / "skills",
    )
    sup.agent_loop = AgentLoopRunners(
        default_model="claude-opus-4-8",
        models=["claude-opus-4-8"],
        build_model=lambda name, effort=None: model,
        registry=registry,
        settings=HarnessSettings(agents_agent_loop_max_turns=2),
        profile=FAKE_PROFILE,
    )
    return sup


@pytest.mark.asyncio
async def test_skill_creator_runs_the_playbook_for_trainers_only(tmp_path: Path) -> None:
    model = ScriptedModel([AIMessage(content="What should the skill do?"), AIMessage(content="ok")])
    sup = _supervisor(tmp_path, model)

    await sup.run(
        UserRequest(message="/skill-creator weekly trip report", tenant_id="acme", trainer=True)
    )
    await sup.run(UserRequest(message="/skill-creator weekly trip report", tenant_id="acme"))

    trainer_run, plain_run = str(model.calls[0]), str(model.calls[1])
    assert "# Active skill: skill-creator" in trainer_run
    assert "Goal: weekly trip report" in trainer_run
    assert "# Active skill: skill-creator" not in plain_run
    assert "Learning session command" not in plain_run


@pytest.mark.asyncio
async def test_layers_and_test_are_answered_without_the_model(tmp_path: Path) -> None:
    rules = tmp_path / "context" / "tenants" / "acme" / "learned"
    rules.mkdir(parents=True)
    (rules / "loaded.md").write_text("---\ntitle: Loaded trips\n---\n\nSent to monitoring.\n")
    model = ScriptedModel([])
    sup = _supervisor(tmp_path, model)

    layers = await sup.run(UserRequest(message="/layers", tenant_id="acme", trainer=True))
    test = await sup.run(UserRequest(message="/test", tenant_id="acme", trainer=True))

    assert "- `rules/loaded.md` Loaded trips" in (layers.answer or "")
    assert test.answer == "Evaluations are not available in this deployment yet."
    assert model.calls == []


@pytest.mark.asyncio
async def test_test_asks_the_agent_to_run_the_evaluation_tool(tmp_path: Path) -> None:
    model = ScriptedModel([AIMessage(content="Scores follow.")])
    sup = _supervisor(tmp_path, model)
    sup.tools.register(
        run_learning_eval_tool(lambda: None, sup.knowledge_store_for, max_cases=5, wait_seconds=1)
    )

    record = await sup.run(
        UserRequest(message="/test how many trips today?", tenant_id="acme", trainer=True)
    )

    assert record.answer == "Scores follow."
    sent = str(model.calls[0])
    assert "Call `run_learning_eval`" in sent
    assert "how many trips today?" in sent
    assert "run_learning_eval" in {t["name"] for t in model.bound_tools or []}
