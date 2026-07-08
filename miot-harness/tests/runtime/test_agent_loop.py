from typing import Any

import pytest
from langchain_core.messages import AIMessage, ToolMessage

import miot_harness.runtime.agent_loop as agent_loop_mod
from miot_harness.config import HarnessSettings
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
