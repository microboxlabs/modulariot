"""Conversational memory store (plan 13, E5).

v1 in-memory dict keyed by `conversation_id`. The interface
(`ConversationStore`) exists from day one so v2 can swap in a
Redis-backed store without retouching call sites.

`HarnessRunRecord.conversation_id` is the telemetry attribute that
groups runs from the same multi-turn chat in Langfuse.

`summarize_if_needed` fires plan 12's summarizer when the transcript
exceeds the configured turn cap (default 10). The store then keeps a
compact `summary` field plus the most-recent turns so context stays
under the LLM's window.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Protocol

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

_DEFAULT_SUMMARIZE_AT_TURNS = 10
_DEFAULT_HYDRATE_LAST_N = 10


@dataclass(frozen=True, slots=True)
class ConversationTurn:
    user_message: str
    assistant_answer: str


@dataclass
class ConversationHistory:
    conversation_id: str
    turns: list[ConversationTurn] = field(default_factory=list)
    summary: str | None = None


class ConversationStore(Protocol):
    """Interface — v2 Redis implementation is a drop-in for this Protocol."""

    def get(self, conversation_id: str) -> ConversationHistory | None: ...

    def append(self, conversation_id: str, turn: ConversationTurn) -> None: ...

    async def summarize_if_needed(
        self,
        conversation_id: str,
        *,
        summarizer: Callable[[ConversationHistory], Awaitable[str]],
    ) -> bool: ...


class InMemoryConversationStore:
    """Dict-keyed in-memory store. Lost on process restart — acceptable for v1.

    Concurrency: single event loop, no locks. If we ever go multi-event-loop
    (uvicorn workers), v2 Redis becomes the seam.
    """

    def __init__(self, *, summarize_at_turns: int = _DEFAULT_SUMMARIZE_AT_TURNS) -> None:
        self._histories: dict[str, ConversationHistory] = {}
        self._summarize_at_turns = summarize_at_turns

    def get(self, conversation_id: str) -> ConversationHistory | None:
        return self._histories.get(conversation_id)

    def append(self, conversation_id: str, turn: ConversationTurn) -> None:
        history = self._histories.get(conversation_id)
        if history is None:
            history = ConversationHistory(conversation_id=conversation_id)
            self._histories[conversation_id] = history
        history.turns.append(turn)

    async def summarize_if_needed(
        self,
        conversation_id: str,
        *,
        summarizer: Callable[[ConversationHistory], Awaitable[str]],
    ) -> bool:
        history = self._histories.get(conversation_id)
        if history is None:
            return False
        if len(history.turns) <= self._summarize_at_turns:
            return False
        history.summary = await summarizer(history)
        return True


def to_messages(
    history: ConversationHistory,
    *,
    last_n: int = _DEFAULT_HYDRATE_LAST_N,
) -> list[BaseMessage]:
    """Project the most recent ``last_n`` turns into a LangChain message list.

    Used by the supervisor to hydrate `NexoState.prior_messages` before graph
    dispatch. Each `ConversationTurn(user_message, assistant_answer)` expands
    to a `[HumanMessage, AIMessage]` pair, in chronological order. Older
    turns are silently dropped — the hard cap keeps token cost predictable.

    Returns an empty list when the history has no turns. The supervisor's
    docstring promises "multi-turn chats accumulate context across `/runs`
    calls" — this function is the half of that contract that was missing in
    E5.
    """

    recent = history.turns[-last_n:] if last_n > 0 else []
    msgs: list[BaseMessage] = []
    for turn in recent:
        msgs.append(HumanMessage(content=turn.user_message))
        msgs.append(AIMessage(content=turn.assistant_answer))
    return msgs
