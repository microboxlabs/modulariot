"""C6 — the loop reports the turn it ran, for the conversation store.

What it reports is what the next turn replays, so the frozen system prefix,
the prior history and the per-request <system-reminder> blocks are left out:
the first two are held elsewhere, the third is request-scoped.
"""

from __future__ import annotations

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from miot_harness.runtime.agent_loop import _TURN_CAP_NUDGE
from tests.runtime.test_agent_loop import ScriptedModel, _ctx, _runner


@pytest.mark.asyncio
async def test_the_reported_turn_holds_the_tool_call_and_its_result() -> None:
    model = ScriptedModel(
        [
            AIMessage(
                content="",
                tool_calls=[
                    {"name": "fake_kpi_summary", "args": {}, "id": "call-1"}
                ],
            ),
            AIMessage(content="291 services."),
        ]
    )
    delta = await _runner(model).run(
        user_message="how many?",
        ctx=_ctx(),
        prior_messages=[],
        progress=lambda e: None,
    )
    messages = delta["messages"]
    assert [type(m).__name__ for m in messages] == [
        "HumanMessage",
        "AIMessage",
        "ToolMessage",
        "AIMessage",
    ]
    assert messages[0].content == "how many?"
    assert messages[1].tool_calls[0]["name"] == "fake_kpi_summary"
    assert isinstance(messages[2], ToolMessage)
    assert messages[3].content == "291 services."


@pytest.mark.asyncio
async def test_the_reported_turn_drops_the_prefix_and_the_prior_history() -> None:
    model = ScriptedModel([AIMessage(content="hola")])
    prior = [HumanMessage(content="earlier q"), AIMessage(content="earlier a")]
    delta = await _runner(model).run(
        user_message="hola",
        ctx=_ctx(),
        prior_messages=prior,
        progress=lambda e: None,
    )
    messages = delta["messages"]
    assert not any(isinstance(m, SystemMessage) for m in messages)
    assert [m.content for m in messages] == ["hola", "hola"]


@pytest.mark.asyncio
async def test_a_request_scoped_reminder_is_not_stored() -> None:
    """A skill body rides in the user turn as a <system-reminder>. Replaying
    it every later turn would pin a one-off instruction to the thread."""

    model = ScriptedModel([AIMessage(content="done")])
    delta = await _runner(model).run(
        user_message="q",
        ctx=_ctx(),
        prior_messages=[SystemMessage(content="follow this playbook")],
        progress=lambda e: None,
    )
    assert [m.content for m in delta["messages"]] == ["q", "done"]


@pytest.mark.asyncio
async def test_the_turn_cap_nudge_is_not_stored() -> None:
    model = ScriptedModel(
        [
            AIMessage(
                content="",
                tool_calls=[{"name": "fake_kpi_summary", "args": {}, "id": f"c{i}"}],
            )
            for i in range(3)
        ]
        + [AIMessage(content="out of turns")]
    )
    delta = await _runner(model).run(
        user_message="q",
        ctx=_ctx(),
        prior_messages=[],
        progress=lambda e: None,
    )
    assert not any(m.content == _TURN_CAP_NUDGE for m in delta["messages"])
    assert delta["messages"][-1].content == "out of turns"


@pytest.mark.asyncio
async def test_a_tool_call_the_cap_left_unanswered_is_dropped() -> None:
    """The cap breaks on the model's reply even when that reply asked for
    another tool. Storing the tool_use with no tool_result after it would
    make the next request a 400."""

    model = ScriptedModel(
        [
            AIMessage(
                content="",
                tool_calls=[{"name": "fake_kpi_summary", "args": {}, "id": f"c{i}"}],
            )
            for i in range(3)
        ]
        + [
            AIMessage(
                content="partial answer",
                tool_calls=[
                    {"name": "fake_kpi_summary", "args": {}, "id": "never-run"}
                ],
            )
        ]
    )
    delta = await _runner(model).run(
        user_message="q",
        ctx=_ctx(),
        prior_messages=[],
        progress=lambda e: None,
    )
    messages = delta["messages"]
    answered = {m.tool_call_id for m in messages if isinstance(m, ToolMessage)}
    asked = {
        call["id"]
        for m in messages
        if isinstance(m, AIMessage)
        for call in m.tool_calls
    }
    assert asked == answered
    assert "never-run" not in asked
    assert messages[-1].content == "partial answer"
