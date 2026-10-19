"""Conversation memory past one process and past the turn cap.

Compaction after the append, and the summary going out on the record and
coming back with a replay.
"""

from __future__ import annotations

from typing import Any

import pytest
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from miot_harness.runtime.context import ConversationTurnInput, UserRequest
from miot_harness.runtime.conversation import ConversationTurn, InMemoryConversationStore
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.tools.registry import ToolRegistry


def _store_key(conversation_id: str, tenant: str = "orion", user: str = "demo-user") -> str:
    """Mirrors `HarnessSupervisor._conversation_key`."""
    return f"{tenant}/{user}/{conversation_id}"


class _Loop:
    """Answers "ok" and records the prior messages each run received."""

    def __init__(self) -> None:
        self.priors: list[list[BaseMessage]] = []

    async def run(self, *, user_message, ctx, prior_messages, progress) -> dict[str, Any]:
        self.priors.append(list(prior_messages))
        return {"answer": "ok", "messages": [AIMessage(content="ok")]}


def _build_supervisor(
    tmp_path: Any, loop: _Loop, *, conversation_store: InMemoryConversationStore
) -> HarnessSupervisor:
    return HarnessSupervisor(
        tools=ToolRegistry(),
        run_store=JsonRunStore(tmp_path),
        agent_loop=loop,
        conversation_store=conversation_store,
        tenant_lock="orion",
    )


@pytest.mark.asyncio
async def test_history_is_compacted_once_past_the_turn_cap(tmp_path: Any) -> None:
    """Past the store's cap the older turns fold into a summary, and the run
    record carries that summary so the caller can persist it."""

    store = InMemoryConversationStore(summarize_at_turns=2, keep_recent_turns=0)
    loop = _Loop()
    summarized: list[str] = []

    async def summarizer(history: Any) -> str:
        summarized.append(",".join(turn.user_message for turn in history.turns))
        return "so far: " + summarized[-1]

    supervisor = _build_supervisor(
        tmp_path,
        loop,
        conversation_store=store,
    )
    supervisor.conversation_summarizer = summarizer

    records = [
        await supervisor.run(
            UserRequest(message=message, tenant_id="orion", conversation_id="conv-cap")
        )
        for message in ("q1", "q2", "q3")
    ]

    assert [r.conversation_summary for r in records] == [None, None, "so far: q1,q2,q3"]
    history = store.get(_store_key("conv-cap"))
    assert history is not None
    assert history.summary == "so far: q1,q2,q3"
    assert history.turns == []


@pytest.mark.asyncio
async def test_a_failing_summarizer_leaves_the_history_and_the_run_alone(
    tmp_path: Any,
) -> None:
    store = InMemoryConversationStore(summarize_at_turns=1)
    loop = _Loop()

    async def summarizer(history: Any) -> str:
        raise RuntimeError("model down")

    supervisor = _build_supervisor(
        tmp_path,
        loop,
        conversation_store=store,
    )
    supervisor.conversation_summarizer = summarizer

    for message in ("q1", "q2"):
        record = await supervisor.run(
            UserRequest(message=message, tenant_id="orion", conversation_id="conv-fail")
        )
        assert record.status == "completed"
        assert record.conversation_summary is None

    history = store.get(_store_key("conv-fail"))
    assert history is not None
    assert [turn.user_message for turn in history.turns] == ["q1", "q2"]


@pytest.mark.asyncio
async def test_a_replayed_summary_reaches_the_loop_ahead_of_the_turns(
    tmp_path: Any,
) -> None:
    """After a restart the caller hands back the summary it stored with the
    last turns; both must be there for the next answer."""

    store = InMemoryConversationStore()
    loop = _Loop()
    supervisor = _build_supervisor(
        tmp_path,
        loop,
        conversation_store=store,
    )

    await supervisor.run(
        UserRequest(
            message="q9",
            tenant_id="orion",
            conversation_id="conv-sum",
            conversation_summary="user is auditing last month's trips",
            conversation_history=[
                ConversationTurnInput(user_message="q8", assistant_answer="a8"),
            ],
        )
    )

    prior = loop.priors[-1]
    assert isinstance(prior[0], HumanMessage)
    assert "user is auditing last month's trips" in str(prior[0].content)
    assert [m.content for m in prior[1:]] == ["q8", "a8"]

    history = store.get(_store_key("conv-sum"))
    assert history is not None
    assert history.summary == "user is auditing last month's trips"
    assert [turn.user_message for turn in history.turns] == ["q8", "q9"]


@pytest.mark.asyncio
async def test_a_summary_alone_seeds_an_unknown_conversation(tmp_path: Any) -> None:
    """Every earlier turn can have been compacted, leaving nothing to replay
    but the summary. That still has to seed."""

    store = InMemoryConversationStore()
    loop = _Loop()
    supervisor = _build_supervisor(
        tmp_path,
        loop,
        conversation_store=store,
    )

    await supervisor.run(
        UserRequest(
            message="q1",
            tenant_id="orion",
            conversation_id="conv-only-sum",
            conversation_summary="the gist",
        )
    )

    prior = loop.priors[-1]
    assert prior and "the gist" in str(prior[0].content)
    history = store.get(_store_key("conv-only-sum"))
    assert history is not None
    assert history.summary == "the gist"
    assert [turn.user_message for turn in history.turns] == ["q1"]


@pytest.mark.asyncio
async def test_a_replayed_summary_never_overwrites_a_compacted_history(
    tmp_path: Any,
) -> None:
    store = InMemoryConversationStore()
    loop = _Loop()
    key = _store_key("conv-keep")
    store.append(key, ConversationTurn(user_message="q1", assistant_answer="a1"))
    held = store.get(key)
    assert held is not None
    held.summary = "what this process compacted"
    supervisor = _build_supervisor(
        tmp_path,
        loop,
        conversation_store=store,
    )

    await supervisor.run(
        UserRequest(
            message="q2",
            tenant_id="orion",
            conversation_id="conv-keep",
            conversation_summary="a stale summary from the caller",
            conversation_history=[
                ConversationTurnInput(user_message="q1", assistant_answer="a1"),
                ConversationTurnInput(user_message="qx", assistant_answer="ax"),
            ],
        )
    )

    history = store.get(key)
    assert history is not None
    assert history.summary == "what this process compacted"
