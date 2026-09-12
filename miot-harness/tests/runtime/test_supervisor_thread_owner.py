"""C6 — the agent loop owns every turn of a conversation.

Before this, the router classified each turn on its own: a follow-up like
"did you query the GPS database?" read as a meta question and landed on a
tool-less seat that could not see what the previous turn had run, and
answered that the numbers in it were invented.
"""

from __future__ import annotations

from typing import Any

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from miot_harness.runtime.context import HarnessContext, UserRequest
from miot_harness.runtime.conversation import InMemoryConversationStore
from miot_harness.runtime.router import HarnessRoute, IntentRouter, RouteResult
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.storytelling.module import StorytellingModule
from miot_harness.tools.registry import ToolRegistry
from tests.fixtures.fake_provider import FAKE_PROFILE


class _FixedRouter(IntentRouter):
    def __init__(self, route: HarnessRoute) -> None:
        super().__init__()
        self._route = route

    def route(self, message: str) -> RouteResult:
        return RouteResult(route=self._route, reason="test")


class _RecordingLoop:
    """Loop double that reports a transcript the way the real one does."""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def run(self, *, user_message, ctx, prior_messages, progress):
        self.calls.append(
            {
                "user_message": user_message,
                "ctx": ctx,
                "prior_messages": list(prior_messages),
            }
        )
        return {
            "answer": "loop answer",
            "evidence": [],
            "usage_log": [],
            "messages": [
                HumanMessage(content=user_message),
                AIMessage(
                    content="",
                    tool_calls=[{"name": "fake_query", "args": {}, "id": "c1"}],
                ),
                ToolMessage(content='{"rows_returned": 2}', tool_call_id="c1"),
                AIMessage(content="loop answer"),
            ],
        }


def _supervisor(tmp_path, route: HarnessRoute, *, loop: Any = None, **kwargs):
    sup = HarnessSupervisor(
        router=_FixedRouter(route),
        tools=ToolRegistry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(tmp_path),
        agent_loop=loop,
        **kwargs,
    )
    # The server assigns the profile after construction; the tenant lock it
    # carries is what the override reads.
    sup.profile = FAKE_PROFILE
    return sup


def _ctx(tenant: str = "acme") -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id=tenant, user_id="u")


@pytest.mark.parametrize(
    "route",
    [
        HarnessRoute.DIRECT,
        HarnessRoute.OTHER,
        HarnessRoute.DATA_META,
        HarnessRoute.DATA_QUERY,
    ],
)
def test_every_route_becomes_agentic_when_the_loop_is_wired(tmp_path, route) -> None:
    sup = _supervisor(tmp_path, route, loop=_RecordingLoop())
    result = sup._apply_thread_owner_override(
        RouteResult(route=route, reason="router said so"), _ctx()
    )
    assert result.route == HarnessRoute.DATA_AGENTIC
    assert "agent loop owns the thread" in result.reason


def test_storytelling_keeps_its_own_path(tmp_path) -> None:
    sup = _supervisor(tmp_path, HarnessRoute.STORYTELLING_RUN, loop=_RecordingLoop())
    result = sup._apply_thread_owner_override(
        RouteResult(route=HarnessRoute.STORYTELLING_RUN, reason="story"), _ctx()
    )
    assert result.route == HarnessRoute.STORYTELLING_RUN


def test_off_lock_tenant_keeps_meta(tmp_path) -> None:
    """The loop's own gate would refuse this tenant, so meta stays meta."""
    sup = _supervisor(tmp_path, HarnessRoute.DATA_META, loop=_RecordingLoop())
    result = sup._apply_thread_owner_override(
        RouteResult(route=HarnessRoute.DATA_META, reason="meta"),
        _ctx(tenant="somebody-else"),
    )
    assert result.route == HarnessRoute.DATA_META


def test_no_loop_wired_leaves_the_route_alone(tmp_path) -> None:
    sup = _supervisor(tmp_path, HarnessRoute.DIRECT, loop=None)
    result = sup._apply_thread_owner_override(
        RouteResult(route=HarnessRoute.DIRECT, reason="greeting"), _ctx()
    )
    assert result.route == HarnessRoute.DIRECT


@pytest.mark.asyncio
async def test_a_greeting_reaches_the_loop(tmp_path) -> None:
    loop = _RecordingLoop()
    sup = _supervisor(tmp_path, HarnessRoute.DIRECT, loop=loop)
    record = await sup.run(UserRequest(message="hola", tenant_id="acme"))
    assert record.answer == "loop answer"
    assert loop.calls[0]["user_message"] == "hola"


@pytest.mark.asyncio
async def test_the_next_turn_sees_the_tool_calls_of_the_last_one(tmp_path) -> None:
    loop = _RecordingLoop()
    sup = _supervisor(
        tmp_path,
        HarnessRoute.DATA_AGENTIC,
        loop=loop,
        conversation_store=InMemoryConversationStore(),
    )
    await sup.run(
        UserRequest(message="how many?", tenant_id="acme", conversation_id="c-1")
    )
    await sup.run(
        UserRequest(
            message="did you query it?", tenant_id="acme", conversation_id="c-1"
        )
    )

    replayed = loop.calls[1]["prior_messages"]
    assert [type(m).__name__ for m in replayed] == [
        "HumanMessage",
        "AIMessage",
        "ToolMessage",
        "AIMessage",
    ]
    assert replayed[1].tool_calls[0]["name"] == "fake_query"
    assert replayed[2].content == '{"rows_returned": 2}'


@pytest.mark.asyncio
async def test_a_seat_without_tools_still_sees_only_text(tmp_path) -> None:
    """A tool_use block sent to a model with no such tool is a 400, so the
    tool-less seats keep the text pair even once the loop has stored more."""
    loop = _RecordingLoop()
    sup = _supervisor(
        tmp_path,
        HarnessRoute.DATA_AGENTIC,
        loop=loop,
        conversation_store=InMemoryConversationStore(),
    )
    await sup.run(
        UserRequest(message="how many?", tenant_id="acme", conversation_id="c-2")
    )
    request = UserRequest(message="and now?", tenant_id="acme", conversation_id="c-2")
    text_only = sup._hydrate_history(
        request, loop.calls[0]["ctx"], include_tool_calls=False
    )
    assert [type(m).__name__ for m in text_only] == ["HumanMessage", "AIMessage"]
    assert text_only[1].content == "loop answer"
