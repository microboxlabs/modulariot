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

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Protocol

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    trim_messages,
)

_DEFAULT_SUMMARIZE_AT_TURNS = 10
# Turns left verbatim after a compaction. The intent router reads the
# last turns to place a follow-up; a fully cleared history would leave
# the request right after a compaction with nothing to read.
_DEFAULT_KEEP_RECENT_TURNS = 2
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

    def reset(self, conversation_id: str) -> None: ...

    def seed(self, history: ConversationHistory) -> None: ...

    async def summarize_if_needed(
        self,
        conversation_id: str,
        *,
        summarizer: Callable[[ConversationHistory], Awaitable[str]],
    ) -> bool: ...


class InMemoryConversationStore:
    """Dict-keyed in-memory store. Lost on process restart — acceptable for v1.

    Concurrency: single event loop. Only `summarize_if_needed` awaits, so it
    is the one place another run can interleave; it snapshots the turns it
    folds and takes a per-conversation lock. If we ever go multi-event-loop
    (uvicorn workers), v2 Redis becomes the seam.
    """

    def __init__(
        self,
        *,
        summarize_at_turns: int = _DEFAULT_SUMMARIZE_AT_TURNS,
        keep_recent_turns: int = _DEFAULT_KEEP_RECENT_TURNS,
    ) -> None:
        self._histories: dict[str, ConversationHistory] = {}
        self._summarize_at_turns = summarize_at_turns
        self._keep_recent_turns = max(0, keep_recent_turns)
        self._compactions: dict[str, asyncio.Lock] = {}

    def get(self, conversation_id: str) -> ConversationHistory | None:
        return self._histories.get(conversation_id)

    def reset(self, conversation_id: str) -> None:
        """Forgets a conversation, so the next append starts a fresh history.

        Used when a caller replays a transcript longer than the one held here
        and the local copy has to be replaced rather than appended to.
        """

        self._histories.pop(conversation_id, None)
        self._compactions.pop(conversation_id, None)

    def seed(self, history: ConversationHistory) -> None:
        """Installs a history the caller assembled — a replayed summary with
        no turns has nothing for `append` to attach to."""

        self._histories[history.conversation_id] = history

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
        """Fold the older turns into `summary`, keeping the most recent ones.

        The summarizer runs on a snapshot of the turns being folded, and only
        those are removed afterwards: a turn appended while the model was
        answering stays. A history reset or reseeded meanwhile is left as it
        is. A blank summary is an error, never a compaction — folding turns
        into nothing would lose them.
        """

        lock = self._compactions.setdefault(conversation_id, asyncio.Lock())
        async with lock:
            history = self._histories.get(conversation_id)
            if history is None or len(history.turns) <= self._summarize_at_turns:
                return False
            fold = len(history.turns) - self._keep_recent_turns
            if fold <= 0:
                return False
            snapshot = ConversationHistory(
                conversation_id=conversation_id,
                turns=list(history.turns[:fold]),
                summary=history.summary,
            )
            summary = (await summarizer(snapshot)).strip()
            if not summary:
                raise ValueError("conversation summarizer returned nothing")
            if self._histories.get(conversation_id) is not history:
                return False
            del history.turns[:fold]
            history.summary = summary
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

    When ``history.summary`` is set (after `summarize_if_needed` fires, or
    replayed by the caller), it is prepended as a `HumanMessage` ahead of
    the trimmed turns, so the budget governs only the recent turn tail. A
    human message, not a system one: the caller can replay any text as the
    summary, and it must not outrank the system prompt.

    Returns an empty list when the history is fully empty (no summary, no
    turns) OR ``max_tokens`` is non-positive.
    """

    if max_tokens <= 0:
        return []
    if not history.turns and not history.summary:
        return []
    msgs: list[BaseMessage] = []
    for turn in history.turns:
        msgs.append(HumanMessage(content=turn.user_message))
        msgs.append(AIMessage(content=turn.assistant_answer))
    recent: list[BaseMessage] = (
        trim_messages(
            msgs,
            max_tokens=max_tokens,
            token_counter="approximate",
            strategy="last",
        )
        if msgs
        else []
    )
    if not history.summary:
        return recent
    return [_summary_message(history.summary), *recent]


def _summary_message(summary: str) -> HumanMessage:
    return HumanMessage(content=f"Earlier in this conversation (summary): {summary}")
