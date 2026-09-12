"""Guards on what reaches the loop and what the store keeps after it.

The loop re-gates tenancy on the env override and the profile alone, so a
lock the primary connection declared is invisible to it. And what the loop
wrote is not always what the user was shown.
"""

from __future__ import annotations

from typing import Any

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.conversation import InMemoryConversationStore
from miot_harness.runtime.router import HarnessRoute, IntentRouter, RouteResult
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.storytelling.module import StorytellingModule
from miot_harness.tools.registry import ToolRegistry
from tests.fixtures.fake_provider import FAKE_PROFILE


class _AgenticRouter(IntentRouter):
    def route(self, message: str) -> RouteResult:
        return RouteResult(route=HarnessRoute.DATA_AGENTIC, reason="test")


class _Loop:
    def __init__(self, answer: str = "loop answer") -> None:
        self.answer = answer
        self.calls: list[dict[str, Any]] = []

    async def run(self, *, user_message, ctx, prior_messages, progress):
        self.calls.append({"user_message": user_message, "ctx": ctx})
        return {
            "answer": self.answer,
            "evidence": [],
            "usage_log": [],
            "messages": [
                HumanMessage(content=user_message),
                AIMessage(content=self.answer),
            ],
        }


def _supervisor(tmp_path, loop, **kwargs):
    sup = HarnessSupervisor(
        router=_AgenticRouter(),
        tools=ToolRegistry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(tmp_path),
        agent_loop=loop,
        **kwargs,
    )
    sup.profile = FAKE_PROFILE
    return sup


@pytest.mark.asyncio
async def test_a_connection_lock_the_loop_cannot_see_still_refuses(tmp_path) -> None:
    """The lifespan prefers the primary connection's lock. The loop's own
    gate reads the profile, which does not carry it, so the supervisor has
    to refuse before dispatch however the route was reached."""

    loop = _Loop()
    sup = _supervisor(tmp_path, loop)
    sup.tenant_lock = "another-tenant"

    record = await sup.run(UserRequest(message="count them", tenant_id="acme"))

    assert loop.calls == []
    assert "another-tenant" in record.answer
    assert record.status == "completed"


@pytest.mark.asyncio
async def test_the_matching_tenant_still_reaches_the_loop(tmp_path) -> None:
    loop = _Loop()
    sup = _supervisor(tmp_path, loop)
    sup.tenant_lock = "acme"

    record = await sup.run(UserRequest(message="count them", tenant_id="acme"))

    assert loop.calls[0]["user_message"] == "count them"
    assert record.answer == "loop answer"


@pytest.mark.asyncio
async def test_the_stored_turn_ends_in_the_answer_the_user_saw(tmp_path) -> None:
    """`harden_answer` can rewrite what the loop wrote. Storing the raw text
    would replay an answer the user never saw."""

    store = InMemoryConversationStore()
    # A JSON-blocks answer the hardener repairs into a different string.
    loop = _Loop(answer='[{"type": "markdown", "value": "hola"}')
    sup = _supervisor(tmp_path, loop, conversation_store=store)

    await sup.run(
        UserRequest(message="hola", tenant_id="acme", conversation_id="c1")
    )

    key = sup._conversation_key(
        UserRequest(message="x", tenant_id="acme", conversation_id="c1"),
        loop.calls[0]["ctx"],
    )
    assert key is not None
    history = store.get(key)
    assert history is not None
    stored = history.turns[-1]
    assert stored.messages[-1].content == stored.assistant_answer
