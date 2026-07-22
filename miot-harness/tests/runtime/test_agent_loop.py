from typing import Any

import pytest
from langchain_core.messages import AIMessage, ToolMessage

import miot_harness.runtime.agent_loop as agent_loop_mod
from miot_harness.config import HarnessSettings
from miot_harness.context_skills.registry import ContextSkillsBundle
from miot_harness.context_skills.skill_models import LoadedSkill, PlaybookSkill
from miot_harness.runtime.agent_loop import AgentLoopRunner
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.plan import DataEvidence
from tests.fixtures.fake_provider import FAKE_PROFILE
from tests.test_native_tools import _registry


class ScriptedModel:
    """Stands in for ChatAnthropic: bind_tools returns self; ainvoke pops
    scripted AIMessages and records the exact message lists it was sent."""

    def __init__(self, responses: list[AIMessage]) -> None:
        self.responses = list(responses)
        self.calls: list[list[Any]] = []
        self.bound_tools: list[dict] | None = None

    def bind_tools(self, tools: Any, **kwargs: Any) -> "ScriptedModel":
        self.bound_tools = list(tools)
        return self

    def with_config(self, **kwargs: Any) -> "ScriptedModel":
        return self

    async def ainvoke(self, messages: Any, **kwargs: Any) -> AIMessage:
        self.calls.append(list(messages))
        return self.responses.pop(0)


def _evidence(tool: str = "fake_kpi_summary") -> DataEvidence:
    return DataEvidence(
        step_id="s1", tool=tool, source="FakeSource", refreshed_at=None,
        output={"rows": [{"k": 1}]}, sample_size=1,
    )


def _ctx():
    return UserRequest(message="q", tenant_id="acme", mode="agentic").to_context()


def _settings() -> HarnessSettings:
    return HarnessSettings(agents_agentic_max_turns=3)


def _runner(model: ScriptedModel) -> AgentLoopRunner:
    return AgentLoopRunner(
        model=model, registry=_registry(), settings=_settings(),
        profile=FAKE_PROFILE, provenance_log=None,
    )


_SKILL_BODY = "1. Query the tasks.\n2. Join per-service variables."


_OTHER_CONN_BODY = "Secrets of another connection."


def _skills_bundle() -> ContextSkillsBundle:
    return ContextSkillsBundle(
        playbook_skills=(
            LoadedSkill(
                skill=PlaybookSkill(
                    kind="playbook",
                    id="pending-deliveries",
                    name="Pending Deliveries",
                    when_to_use="Which services are pending delivery.",
                    tools=("fake_kpi_summary",),
                ),
                playbook_body=_SKILL_BODY,
                source_path="/skills/pending-deliveries/SKILL.md",
            ),
            # Bound to a different connection than FAKE_PROFILE ("fake"):
            # never indexed, and must not be loadable by a guessed id.
            LoadedSkill(
                skill=PlaybookSkill(
                    kind="playbook",
                    id="other-conn-skill",
                    name="Other Connection",
                    when_to_use="Never for this profile.",
                    connection="not-fake",
                ),
                playbook_body=_OTHER_CONN_BODY,
                source_path="/skills/other-conn-skill/SKILL.md",
            ),
        )
    )


def _skilled_runner(model: ScriptedModel) -> AgentLoopRunner:
    return AgentLoopRunner(
        model=model, registry=_registry(), settings=_settings(),
        profile=FAKE_PROFILE, provenance_log=None,
        context_skills=_skills_bundle(),
    )


def _text(msg: ToolMessage) -> str:
    """Message text, tolerating the request-time cache-marker block form."""
    if isinstance(msg.content, str):
        return msg.content
    return "".join(b.get("text", "") for b in msg.content if isinstance(b, dict))


def _load_skill_msg(skill_id: str, call_id: str) -> AIMessage:
    return AIMessage(
        content="",
        tool_calls=[
            {
                "name": "load_skill",
                "args": {"skill_id": skill_id},
                "id": call_id,
                "type": "tool_call",
            }
        ],
    )


def _tool_call_msg(name: str = "fake_kpi_summary", call_id: str = "c1") -> AIMessage:
    return AIMessage(
        content="", tool_calls=[{"name": name, "args": {}, "id": call_id, "type": "tool_call"}]
    )


@pytest.mark.asyncio
async def test_direct_answer_no_tools():
    model = ScriptedModel([AIMessage(content="the answer")])
    delta = await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=lambda e: None
    )
    assert delta["answer"] == "the answer"
    assert delta["evidence"] == []
    # tools bound once, sorted
    assert [t["name"] for t in model.bound_tools] == sorted(
        t["name"] for t in model.bound_tools
    )


@pytest.mark.asyncio
async def test_tool_call_produces_evidence_and_tool_message(monkeypatch):
    async def fake_invoke_step(step, **kwargs):
        assert step.tool == "fake_kpi_summary"
        return {"evidence": [_evidence()]}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    model = ScriptedModel([_tool_call_msg(), AIMessage(content="done: 1 row")])
    delta = await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=lambda e: None
    )
    assert delta["answer"] == "done: 1 row"
    assert len(delta["evidence"]) == 1
    # 2nd call saw: system, human, ai(tool_call), tool_result
    second = model.calls[1]
    assert isinstance(second[-1], ToolMessage)
    assert second[-1].tool_call_id == "c1"
    assert "rows" in str(second[-1].content)


@pytest.mark.asyncio
async def test_tool_failure_becomes_error_tool_message(monkeypatch):
    async def fake_invoke_step(step, **kwargs):
        return {"failure": "boom", "error": "boom", "error_type": "RuntimeError"}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    model = ScriptedModel([_tool_call_msg(), AIMessage(content="could not fetch")])
    delta = await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=lambda e: None
    )
    assert delta["answer"] == "could not fetch"
    tm = model.calls[1][-1]
    assert isinstance(tm, ToolMessage)
    assert tm.status == "error"
    assert "boom" in str(tm.content)


@pytest.mark.asyncio
async def test_parallel_tool_calls_all_executed(monkeypatch):
    seen: list[str] = []

    async def fake_invoke_step(step, **kwargs):
        seen.append(step.tool)
        return {"evidence": [_evidence(step.tool)]}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    multi = AIMessage(
        content="",
        tool_calls=[
            {"name": "fake_kpi_summary", "args": {}, "id": "c1", "type": "tool_call"},
            {"name": "fake_alpha_query", "args": {}, "id": "c2", "type": "tool_call"},
        ],
    )
    model = ScriptedModel([multi, AIMessage(content="both done")])
    delta = await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=lambda e: None
    )
    assert seen == ["fake_kpi_summary", "fake_alpha_query"]
    assert len(delta["evidence"]) == 2
    tool_messages = [m for m in model.calls[1] if isinstance(m, ToolMessage)]
    assert {m.tool_call_id for m in tool_messages} == {"c1", "c2"}


@pytest.mark.asyncio
async def test_turn_cap_forces_final_answer(monkeypatch):
    async def fake_invoke_step(step, **kwargs):
        return {"evidence": [_evidence()]}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    # max_turns=3: three tool rounds, then the forced no-more-tools turn.
    model = ScriptedModel(
        [
            _tool_call_msg(call_id="c1"),
            _tool_call_msg(call_id="c2"),
            _tool_call_msg(call_id="c3"),
            AIMessage(content="partial answer from evidence"),
        ]
    )
    delta = await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=lambda e: None
    )
    assert delta["answer"] == "partial answer from evidence"
    # The forced turn told the model to stop calling tools.
    final_call = model.calls[-1]
    assert "Turn cap reached" in str(final_call[-1].content)


@pytest.mark.asyncio
async def test_tenancy_refusal_short_circuits():
    ctx = UserRequest(message="q", tenant_id="intruder", mode="agentic").to_context()
    model = ScriptedModel([])  # must never be called
    delta = await _runner(model).run(
        user_message="q", ctx=ctx, prior_messages=[], progress=lambda e: None
    )
    assert "acme" in delta["answer"].lower() or "only" in delta["answer"].lower()
    assert model.calls == []


@pytest.mark.asyncio
async def test_load_skill_bound_and_indexed_only_with_bundle():
    plain = ScriptedModel([AIMessage(content="x")])
    _runner(plain)
    assert "load_skill" not in [t["name"] for t in plain.bound_tools]

    skilled = ScriptedModel([AIMessage(content="x")])
    runner = _skilled_runner(skilled)
    names = [t["name"] for t in skilled.bound_tools]
    assert "load_skill" in names
    assert names == sorted(names)  # byte-stability contract kept
    system_text = runner.system_message.content[0]["text"]
    assert "pending-deliveries" in system_text
    assert _SKILL_BODY not in system_text  # index only, body stays lazy


@pytest.mark.asyncio
async def test_load_skill_returns_body_without_evidence():
    model = ScriptedModel(
        [_load_skill_msg("pending-deliveries", "c1"), AIMessage(content="ok")]
    )
    events: list[Any] = []
    delta = await _skilled_runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=events.append
    )
    assert delta["answer"] == "ok"
    assert delta["evidence"] == []  # guidance, not data
    tm = model.calls[1][-1]
    assert isinstance(tm, ToolMessage)
    assert tm.tool_call_id == "c1"
    assert "# Skill: Pending Deliveries" in _text(tm)
    assert _SKILL_BODY in _text(tm)
    tool_events = [e for e in events if e.type.startswith("tool.")]
    assert [e.type for e in tool_events] == ["tool.started", "tool.completed"]
    assert all(e.data["tool"] == "load_skill" for e in tool_events)


@pytest.mark.asyncio
async def test_load_skill_unknown_id_is_error_feedback():
    model = ScriptedModel(
        [_load_skill_msg("nope", "c1"), AIMessage(content="answered anyway")]
    )
    events: list[Any] = []
    delta = await _skilled_runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=events.append
    )
    assert delta["answer"] == "answered anyway"
    tm = model.calls[1][-1]
    assert tm.status == "error"
    assert "Unknown or bodyless skill 'nope'" in _text(tm)
    assert "tool.failed" in [e.type for e in events]


@pytest.mark.asyncio
async def test_load_skill_refuses_skill_bound_to_another_connection():
    # The index never advertised it; a guessed id must not smuggle the body in.
    model = ScriptedModel(
        [_load_skill_msg("other-conn-skill", "c1"), AIMessage(content="moved on")]
    )
    runner = _skilled_runner(model)
    assert "other-conn-skill" not in runner.system_message.content[0]["text"]
    await runner.run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=lambda e: None
    )
    tm = model.calls[1][-1]
    assert tm.status == "error"
    assert _OTHER_CONN_BODY not in _text(tm)
    assert "Unknown or bodyless skill 'other-conn-skill'" in _text(tm)


@pytest.mark.asyncio
async def test_load_skill_duplicate_returns_pointer_not_body():
    model = ScriptedModel(
        [
            _load_skill_msg("pending-deliveries", "c1"),
            _load_skill_msg("pending-deliveries", "c2"),
            AIMessage(content="done"),
        ]
    )
    delta = await _skilled_runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=lambda e: None
    )
    assert delta["answer"] == "done"
    second = model.calls[2][-1]
    assert isinstance(second, ToolMessage)
    assert "already loaded" in _text(second)
    assert _SKILL_BODY not in _text(second)


@pytest.mark.asyncio
async def test_events_emitted(monkeypatch):
    async def fake_invoke_step(step, **kwargs):
        return {"evidence": [_evidence()]}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    events: list[Any] = []
    model = ScriptedModel([_tool_call_msg(), AIMessage(content="ok")])
    await _runner(model).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=events.append
    )
    types = [e.type for e in events]
    assert "agent.started" in types
    assert "agent.completed" in types
    assert "answer.completed" in types
