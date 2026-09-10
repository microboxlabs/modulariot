"""Advisor and workhorse seats as tools of the agent loop."""

from __future__ import annotations

import json
from typing import Any

import pytest
from langchain_core.messages import AIMessage, ToolMessage

import miot_harness.runtime.agent_loop as agent_loop_mod
from miot_harness.config import HarnessSettings
from miot_harness.runtime.agent_loop import AgentLoopRunner
from miot_harness.runtime.agent_seats import (
    ADVISOR_TOOL,
    DELEGATE_TOOL,
    AdvisorSeat,
    LoopSeats,
    WorkhorseSeat,
)
from miot_harness.runtime.context import UserRequest
from tests.fixtures.fake_provider import FAKE_PROFILE
from tests.runtime.test_agent_loop import ScriptedModel, _evidence, _text
from tests.test_native_tools import _registry


def _ctx(conversation_id: str = "conv-1"):
    return UserRequest(
        message="q", tenant_id="acme", mode="agentic", conversation_id=conversation_id
    ).to_context()


def _settings(max_turns: int = 3) -> HarnessSettings:
    return HarnessSettings(agents_agentic_max_turns=max_turns)


def _runner(model: ScriptedModel, seats: LoopSeats | None) -> AgentLoopRunner:
    return AgentLoopRunner(
        model=model,
        registry=_registry(),
        settings=_settings(),
        profile=FAKE_PROFILE,
        provenance_log=None,
        seats=seats,
    )


def _call(name: str, args: dict[str, Any], call_id: str) -> dict[str, Any]:
    return {"name": name, "args": args, "id": call_id, "type": "tool_call"}


def _advisor(responses: list[str], max_consults: int = 2) -> tuple[AdvisorSeat, ScriptedModel]:
    model = ScriptedModel([AIMessage(content=r) for r in responses])
    return AdvisorSeat(model=model, display_name="Fake", max_consults=max_consults), model


def test_seat_tools_appear_only_when_wired() -> None:
    bare = _runner(ScriptedModel([]), None)
    assert ADVISOR_TOOL not in [t["name"] for t in bare.native_tools]
    assert "Seats you can call" not in bare.system_message.content[0]["text"]
    advisor, _ = _advisor([])
    seated = _runner(ScriptedModel([]), LoopSeats(advisor=advisor))
    names = [t["name"] for t in seated.native_tools]
    assert ADVISOR_TOOL in names and DELEGATE_TOOL not in names
    assert names == sorted(names)
    assert "at most 2 consults" in seated.system_message.content[0]["text"].lower()


@pytest.mark.asyncio
async def test_advisor_consult_returns_a_signal_and_keeps_the_transcript() -> None:
    advisor, advisor_model = _advisor(
        ["CORRECTION: the grep is a sample; run COUNT(*) first.", "ENDORSE\nGood."]
    )
    consult = _call(
        ADVISOR_TOOL,
        {"assignment": "count late trips", "delta": "grep ran", "decision": "answer now?"},
        "a1",
    )
    model = ScriptedModel(
        [
            AIMessage(content="", tool_calls=[consult]),
            AIMessage(content="", tool_calls=[{**consult, "id": "a2"}]),
            AIMessage(content="done"),
        ]
    )
    events: list[Any] = []
    delta = await _runner(model, LoopSeats(advisor=advisor)).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=events.append
    )
    assert delta["answer"] == "done"
    first = json.loads(_text(next(m for m in model.calls[1] if isinstance(m, ToolMessage))))
    assert first["signal"] == "CORRECTION"
    assert "COUNT(*)" in first["note"]
    assert (first["consult"], first["max_consults"]) == (1, 2)
    consulted = [e for e in events if e.type == "advisor.consulted"]
    assert [e.data["signal"] for e in consulted] == ["CORRECTION", "ENDORSE"]
    # The second consult carried the first exchange: system + 2 prior + new human.
    assert len(advisor_model.calls[1]) == 4
    assert advisor_model.calls[1][1].content.startswith("Assignment: count late trips")


@pytest.mark.asyncio
async def test_advisor_budget_is_enforced_without_a_model_call() -> None:
    advisor, advisor_model = _advisor(["ENDORSE ok"], max_consults=1)
    consult = _call(ADVISOR_TOOL, {"assignment": "a", "delta": "d", "decision": "x"}, "a1")
    model = ScriptedModel(
        [
            AIMessage(content="", tool_calls=[consult]),
            AIMessage(content="", tool_calls=[{**consult, "id": "a2"}]),
            AIMessage(content="done"),
        ]
    )
    await _runner(model, LoopSeats(advisor=advisor)).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=lambda e: None
    )
    second = json.loads(_text([m for m in model.calls[2] if isinstance(m, ToolMessage)][-1]))
    assert second["signal"] == "BUDGET"
    assert len(advisor_model.calls) == 1


@pytest.mark.asyncio
async def test_delegate_runs_briefs_concurrently_and_merges_evidence(monkeypatch) -> None:
    async def fake_invoke_step(step, **kwargs):
        return {"evidence": [_evidence()]}

    monkeypatch.setattr(agent_loop_mod, "invoke_step", fake_invoke_step)
    inner = ScriptedModel(
        [
            AIMessage(content="", tool_calls=[_call("fake_kpi_summary", {}, "w1")]),
            AIMessage(content="41 late trips"),
            AIMessage(content="", tool_calls=[_call("fake_kpi_summary", {}, "w2")]),
            AIMessage(content="12 on time"),
        ]
    )
    workhorse = WorkhorseSeat(build=lambda: _runner(inner, None), max_parallel=2)
    parent = ScriptedModel(
        [
            AIMessage(
                content="",
                tool_calls=[
                    _call(DELEGATE_TOOL, {"brief": "count late", "expected": "a number"}, "d1"),
                    _call(DELEGATE_TOOL, {"brief": "count on time"}, "d2"),
                ],
            ),
            AIMessage(content="41 late, 12 on time"),
        ]
    )
    events: list[Any] = []
    delta = await _runner(parent, LoopSeats(workhorse=workhorse)).run(
        user_message="q", ctx=_ctx(), prior_messages=[], progress=events.append
    )
    assert delta["answer"] == "41 late, 12 on time"
    assert len(delta["evidence"]) == 2
    results = [json.loads(_text(m)) for m in parent.calls[1] if isinstance(m, ToolMessage)]
    assert {r["summary"] for r in results} == {"41 late trips", "12 on time"}
    assert all(r["tools_run"] == ["fake_kpi_summary"] and r["turns"] == 2 for r in results)
    assert [e.type for e in events].count("delegate.completed") == 2
    # The workhorse's own text never reaches the parent's answer stream.
    answer_deltas = [e.data["delta"] for e in events if e.type == "answer.delta"]
    assert answer_deltas == ["41 late, 12 on time"]
    assert {e.data.get("agent") for e in events if e.type == "agent.started"} == {
        "agent_loop",
        "workhorse",
    }
    # The brief reached the inner loop as its user message, with the expected shape.
    briefs = {_text(inner.calls[i][-1]) for i in (0, 2)}
    assert any(b.endswith("Return: a number") for b in briefs)
