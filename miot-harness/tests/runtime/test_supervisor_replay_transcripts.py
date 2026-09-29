"""A client replay must not cost a replica the transcripts it recorded.

The replay carries text only. Resetting the local history and re-appending it
verbatim downgrades turns this replica ran itself, which is exactly the memory
loss the replay exists to repair.
"""

from __future__ import annotations

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from miot_harness.runtime.context import ConversationTurnInput, HarnessContext, UserRequest
from miot_harness.runtime.conversation import (
    ConversationTurn,
    InMemoryConversationStore,
)
from miot_harness.runtime.router import HarnessRoute, IntentRouter, RouteResult
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.storytelling.module import StorytellingModule
from miot_harness.tools.registry import ToolRegistry
from tests.fixtures.fake_provider import FAKE_PROFILE


class _FixedRouter(IntentRouter):
    def route(self, message: str) -> RouteResult:
        return RouteResult(route=HarnessRoute.DATA_AGENTIC, reason="test")


def _supervisor(tmp_path, store):
    sup = HarnessSupervisor(
        router=_FixedRouter(),
        tools=ToolRegistry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(tmp_path),
        conversation_store=store,
    )
    sup.profile = FAKE_PROFILE
    return sup


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="acme", user_id="u")


def _recorded(question: str, answer: str, call_id: str) -> ConversationTurn:
    return ConversationTurn(
        user_message=question,
        assistant_answer=answer,
        messages=(
            HumanMessage(content=question),
            AIMessage(
                content="",
                tool_calls=[{"name": "acs_query", "args": {}, "id": call_id}],
            ),
            ToolMessage(content='{"total": 7}', tool_call_id=call_id),
            AIMessage(content=answer),
        ),
    )


def test_a_replay_keeps_the_transcripts_this_replica_already_had(tmp_path) -> None:
    store = InMemoryConversationStore()
    sup = _supervisor(tmp_path, store)
    ctx = _ctx()
    key = f"{ctx.tenant_id}/{ctx.user_id}/chat"

    store.append(key, _recorded("how many?", "seven", "c1"))

    # The caller replays three turns; this replica holds one of them.
    request = UserRequest(
        message="and now?",
        tenant_id="acme",
        user_id="u",
        conversation_id="chat",
        conversation_history=[
            ConversationTurnInput(user_message="how many?", assistant_answer="seven"),
            ConversationTurnInput(user_message="elsewhere", assistant_answer="ok"),
            ConversationTurnInput(user_message="also elsewhere", assistant_answer="ok"),
        ],
    )
    history = sup._seeded_history(request, ctx)

    assert history is not None
    assert [t.user_message for t in history.turns] == [
        "how many?",
        "elsewhere",
        "also elsewhere",
    ]
    kept = next(t for t in history.turns if t.user_message == "how many?")
    assert [type(m).__name__ for m in kept.messages] == [
        "HumanMessage",
        "AIMessage",
        "ToolMessage",
        "AIMessage",
    ]
    # Turns this replica never ran stay text-only; there is nothing to keep.
    other = next(t for t in history.turns if t.user_message == "elsewhere")
    assert other.messages == ()


@pytest.mark.parametrize("tenant_block", ["", "Acme runs two depots."])
def test_the_loop_is_handed_the_tenant_context_the_meta_seat_had(
    tmp_path, tenant_block
) -> None:
    """`_run_data_meta` carried the tenant overlay and the loop took its
    route over. The loop's own prompt is the frozen cache prefix, so it
    cannot hold per-tenant text: it rides in the user turn instead."""

    class _Primer:
        def __init__(self, block: str) -> None:
            self.tenant_block = block

    class _Bundle:
        def primer_for(self, tenant_id: str):
            return _Primer(tenant_block)

        def facts_for(self, tenant_id: str):
            return []

    sup = _supervisor(tmp_path, InMemoryConversationStore())
    sup.context_skills = _Bundle()  # type: ignore[assignment]

    injected = sup._inject_tenant_context(_ctx(), [])
    if tenant_block:
        assert isinstance(injected[0], SystemMessage)
        assert tenant_block in str(injected[0].content)
    else:
        assert injected == []
