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

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    trim_messages,
)

_DEFAULT_SUMMARIZE_AT_TURNS = 10
# Token budget for the supervisor's hydration call. Sized against
# Haiku-4-5's 200K context window (the smallest model in our pool).
# Higher = better multi-turn continuity at more tokens per request.
_DEFAULT_TOKEN_BUDGET = 24_000


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
        # Compact: the summary represents the prior turns; keeping them
        # alongside would just grow memory and double-count context in
        # `to_messages`. Subsequent `append()` calls rebuild a fresh tail.
        history.turns.clear()
        return True


def to_messages(
    history: ConversationHistory,
    *,
    max_tokens: int = _DEFAULT_TOKEN_BUDGET,
) -> list[BaseMessage]:
    """Project history into a LangChain message list, trimmed to a token budget.

    Used by the supervisor to hydrate `DataState.prior_messages` before graph
    dispatch. Each `ConversationTurn(user_message, assistant_answer)` expands
    to a `[HumanMessage, AIMessage]` pair (chronological order); we then
    delegate to `langchain_core.messages.trim_messages` with
    ``token_counter="approximate"`` and ``strategy="last"`` so the most-recent
    messages that fit under ``max_tokens`` are returned. Older context is
    silently dropped — appropriate for chat memory, since recent context
    dominates relevance.

    Why token budget instead of last-N turns: our `synthesizer` produces
    Markdown answers in the 3–5K-token range. A uniform last-N cap can mean
    "200 tokens" or "50K tokens" for the same N. The budget is the actual
    constraint (context-window cost), so we trim against it directly.

    When ``history.summary`` is set (after `summarize_if_needed` fires), it
    is prepended as a single `SystemMessage` so compacted older context
    actually reaches the LLM. ``include_system=True`` anchors it past
    `trim_messages` so the budget governs only the recent turn tail.

    Returns an empty list when the history is fully empty (no summary, no
    turns) OR ``max_tokens`` is non-positive.
    """

    if max_tokens <= 0:
        return []
    if not history.turns and not history.summary:
        return []
    msgs: list[BaseMessage] = []
    if history.summary:
        msgs.append(
            SystemMessage(content=f"Earlier in this conversation: {history.summary}")
        )
    for turn in history.turns:
        msgs.append(HumanMessage(content=turn.user_message))
        msgs.append(AIMessage(content=turn.assistant_answer))
    return trim_messages(
        msgs,
        max_tokens=max_tokens,
        token_counter="approximate",
        strategy="last",
        # Anchor any `SystemMessage` (the compacted summary, when present)
        # so it survives trimming. The caller's own system prompt is added
        # downstream and isn't subject to this budget.
        include_system=True,
    )
