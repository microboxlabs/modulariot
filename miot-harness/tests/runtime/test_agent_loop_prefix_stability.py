"""Every request extends the one before it byte for byte, within a run and
from one run of a conversation to the next, so the provider's prompt cache
covers everything but the new tail."""

from __future__ import annotations

import json
from typing import Any

import pytest
from langchain_core.messages import AIMessage, SystemMessage

from miot_harness.runtime.agent_loop import AgentLoopRunner
from tests.fixtures.fake_provider import FAKE_PROFILE
from tests.runtime.test_agent_loop import ScriptedModel, _ctx, _settings, _tool_call_msg
from tests.test_native_tools import _registry

_REMINDERS = [
    SystemMessage(content="# System facts (tenant)\n- Two depots."),
    SystemMessage(content="# Output format: JSON blocks"),
]


def _runner(model: ScriptedModel, *, anthropic: bool) -> AgentLoopRunner:
    return AgentLoopRunner(
        model=model,  # type: ignore[arg-type]
        registry=_registry(),
        settings=_settings(),
        profile=FAKE_PROFILE,
        provenance_log=None,
        anthropic_format=anthropic,
    )


def _anthropic_messages(messages: list[Any]) -> list[Any]:
    from langchain_anthropic import ChatAnthropic

    model = ChatAnthropic(model_name="claude-sonnet-4-6", api_key="test-key")
    return model._get_request_payload(messages)["messages"]


def _openai_messages(messages: list[Any]) -> list[Any]:
    from langchain_openai import ChatOpenAI

    model = ChatOpenAI(model="gpt-4o", api_key="test-key")
    return model._get_request_payload(messages)["messages"]


def _unmarked(node: Any) -> Any:
    """The payload as the cache sees it: markers dropped, text as blocks."""
    if isinstance(node, list):
        return [_unmarked(x) for x in node]
    if isinstance(node, dict):
        out = {k: _unmarked(v) for k, v in node.items() if k != "cache_control"}
        textual = out.get("role") in ("user", "assistant") or out.get("type") == "tool_result"
        if isinstance(out.get("content"), str) and textual:
            out["content"] = [{"type": "text", "text": out["content"]}]
        return out
    return node


async def _two_runs(anthropic: bool) -> list[list[Any]]:
    """Two runs of one conversation, each with a tool call and an answer.
    Returns every request the model was sent, in order."""
    model = ScriptedModel(
        [
            _tool_call_msg(call_id="c1"),
            AIMessage(content="41 trips."),
            _tool_call_msg(call_id="c2"),
            AIMessage(content="12 of them late."),
        ]
    )
    runner = _runner(model, anthropic=anthropic)
    first = await runner.run(
        user_message="trips today?",
        ctx=_ctx(),
        prior_messages=list(_REMINDERS),
        progress=lambda e: None,
    )
    await runner.run(
        user_message="how many late?",
        ctx=_ctx(),
        prior_messages=[*_REMINDERS, *first["messages"]],
        progress=lambda e: None,
    )
    return model.calls


@pytest.mark.asyncio
@pytest.mark.parametrize("anthropic", [True, False])
async def test_each_request_extends_the_previous_one(anthropic: bool) -> None:
    calls = await _two_runs(anthropic)
    assert len(calls) == 4
    to_wire = _anthropic_messages if anthropic else _openai_messages
    wire = [_unmarked(to_wire(call)) for call in calls]
    for before, after in zip(wire, wire[1:], strict=False):
        assert after[: len(before)] == before
        assert len(after) > len(before)


@pytest.mark.asyncio
async def test_reminders_lead_the_first_user_message_with_their_own_breakpoint() -> None:
    calls = await _two_runs(anthropic=True)
    second_run_first_request = _anthropic_messages(calls[2])
    first_user = second_run_first_request[0]["content"]
    assert first_user[0]["text"].startswith("<system-reminder>")
    assert first_user[0]["cache_control"] == {"type": "ephemeral"}
    assert first_user[1]["text"] == "trips today?"
    latest = second_run_first_request[-1]["content"]
    assert "<system-reminder>" not in json.dumps(latest)
    # system + reminders + tail: within the API's four.
    for call in calls:
        from langchain_anthropic import ChatAnthropic

        payload = ChatAnthropic(model_name="claude-sonnet-4-6", api_key="k")._get_request_payload(
            call
        )
        assert json.dumps(payload).count('"cache_control"') == 3


@pytest.mark.asyncio
async def test_without_reminders_the_user_message_stays_a_string() -> None:
    model = ScriptedModel([AIMessage(content="hola")])
    await _runner(model, anthropic=False).run(
        user_message="hola", ctx=_ctx(), prior_messages=[], progress=lambda e: None
    )
    assert model.calls[0][-1].content == "hola"
