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
import json
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Protocol

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    trim_messages,
)
from langchain_core.messages.utils import count_tokens_approximately

_DEFAULT_SUMMARIZE_AT_TURNS = 10
# Turns left verbatim after a compaction. The intent router reads the
# last turns to place a follow-up; a fully cleared history would leave
# the request right after a compaction with nothing to read.
_DEFAULT_KEEP_RECENT_TURNS = 2
# Conversations held at once, least-recently-used evicted first. Matches the
# advisor transcript cap in `agent_seats`.
_DEFAULT_MAX_CONVERSATIONS = 512
# Characters held across all conversations, tool results included. 32M is
# roughly 64MB of Python strings: a bound the pod survives, and far more
# than any single chat needs.
_DEFAULT_MAX_CHARS = 32_000_000
# Token budget for the supervisor's hydration call. Sized against
# Haiku-4-5's 200K context window (the smallest model in our pool).
# Higher = better multi-turn continuity at more tokens per request.
_DEFAULT_TOKEN_BUDGET = 24_000


@dataclass(frozen=True, slots=True)
class ConversationTurn:
    """One exchange.

    `messages` is the turn as the agent loop ran it: the user message, each
    assistant message with its tool calls, and each tool result. Empty for
    turns produced by a seat that does not report them, and for a transcript
    replayed by a caller, which carries text only. `to_messages` replays it
    for the loop and falls back to the text pair for everyone else.
    """

    user_message: str
    assistant_answer: str
    messages: tuple[BaseMessage, ...] = ()


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
        max_conversations: int = _DEFAULT_MAX_CONVERSATIONS,
        max_chars: int = _DEFAULT_MAX_CHARS,
    ) -> None:
        self._histories: OrderedDict[str, ConversationHistory] = OrderedDict()
        self._summarize_at_turns = summarize_at_turns
        self._keep_recent_turns = max(0, keep_recent_turns)
        self._max_conversations = max(1, max_conversations)
        self._max_chars = max(1, max_chars)
        self._chars: dict[str, int] = {}
        self._compactions: dict[str, asyncio.Lock] = {}

    def get(self, conversation_id: str) -> ConversationHistory | None:
        history = self._histories.get(conversation_id)
        if history is not None:
            self._histories.move_to_end(conversation_id)
        return history

    def _evict(self) -> None:
        """Drop the conversations idle longest once either cap is passed.

        A turn holds its tool envelopes now, so a conversation costs orders of
        magnitude more than the two strings it used to be, and a long-lived
        pod accumulates one entry per chat that ever ran through it. Counting
        conversations alone does not bound that: one chat that ran a dozen
        queries a turn is worth hundreds of the greetings next to it. So the
        character total is capped too, and both caps evict the same way.
        """

        while len(self._histories) > self._max_conversations or (
            len(self._histories) > 1 and sum(self._chars.values()) > self._max_chars
        ):
            evicted, _ = self._histories.popitem(last=False)
            self._chars.pop(evicted, None)
        # A lock held by a compaction that is still awaiting its summarizer
        # stays: dropping it would let the next call take a fresh lock and run
        # a second summarizer over the same conversation. The rest go.
        for key, lock in list(self._compactions.items()):
            if key not in self._histories and not lock.locked():
                del self._compactions[key]

    def _remeasure(self, conversation_id: str) -> None:
        """Refresh one conversation's size. Kept per id and summed on demand
        so an append costs the turn it added, not a walk of every history."""

        history = self._histories.get(conversation_id)
        if history is None:
            self._chars.pop(conversation_id, None)
            return
        self._chars[conversation_id] = _history_chars(history)

    def reset(self, conversation_id: str) -> None:
        """Forgets a conversation, so the next append starts a fresh history.

        Used when a caller replays a transcript longer than the one held here
        and the local copy has to be replaced rather than appended to.
        """

        self._histories.pop(conversation_id, None)
        self._compactions.pop(conversation_id, None)
        self._chars.pop(conversation_id, None)

    def seed(self, history: ConversationHistory) -> None:
        """Installs a history the caller assembled — a replayed summary with
        no turns has nothing for `append` to attach to."""

        self._histories[history.conversation_id] = history
        self._histories.move_to_end(history.conversation_id)
        self._remeasure(history.conversation_id)
        self._evict()

    def append(self, conversation_id: str, turn: ConversationTurn) -> None:
        history = self._histories.get(conversation_id)
        if history is None:
            history = ConversationHistory(conversation_id=conversation_id)
            self._histories[conversation_id] = history
        history.turns.append(turn)
        self._histories.move_to_end(conversation_id)
        self._remeasure(conversation_id)
        self._evict()

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
            self._remeasure(conversation_id)
            return True


def to_messages(
    history: ConversationHistory,
    *,
    max_tokens: int = _DEFAULT_TOKEN_BUDGET,
    include_tool_calls: bool = False,
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

    ``include_tool_calls`` replays each turn's full message list (tool calls
    and tool results included) when the turn carries one. Only the agent loop
    may ask for it: it is the seat that binds the tools those messages refer
    to, and a tool_use block sent to a model without that tool is a 400. The
    tool-less seats keep the text pair. Trimming starts on a human message,
    so a tool result is never replayed without the call that produced it.

    A tool replay that does not fit at all falls back to the text pairs
    rather than to nothing: one turn that ran thirty queries can be larger
    than the whole budget, and dropping it would lose the context this
    replay exists to keep.

    Returns an empty list when the history is fully empty (no summary, no
    turns) OR ``max_tokens`` is non-positive.
    """

    if max_tokens <= 0:
        return []
    if not history.turns and not history.summary:
        return []
    recent = _trim(_project(history.turns, include_tool_calls, max_tokens), max_tokens)
    if include_tool_calls and not recent:
        recent = _trim(_text_pairs(history.turns), max_tokens)
    if not history.summary:
        return recent
    return [_summary_message(history.summary), *recent]


def _turn_messages(turn: ConversationTurn) -> list[BaseMessage]:
    """A stored turn, always ending in the answer the user was shown.

    A transcript can end without one: the loop drops an assistant message
    that carries neither text nor a surviving tool call, which is what an
    empty reply at the turn cap leaves behind. Replaying only the question
    and its tool results would lose the answer this store exists to keep.
    """

    msgs = list(turn.messages)
    if not msgs:
        return _text_pairs([turn])
    last = msgs[-1]
    if not (isinstance(last, AIMessage) and last.content):
        msgs.append(AIMessage(content=turn.assistant_answer))
    return msgs


def _text_pairs(turns: list[ConversationTurn]) -> list[BaseMessage]:
    msgs: list[BaseMessage] = []
    for turn in turns:
        msgs.append(HumanMessage(content=turn.user_message))
        msgs.append(AIMessage(content=turn.assistant_answer))
    return msgs


def _project(
    turns: list[ConversationTurn], include_tool_calls: bool, max_tokens: int
) -> list[BaseMessage]:
    """Turns as messages, the newest keeping their tool history.

    Tool envelopes cost far more than the answer they produced, so a budget
    that holds ten text pairs holds about six turns of tool history. Spending
    it newest-first and letting the older turns fall back to their text keeps
    the conversation's full span: detail degrades, turns do not disappear.
    """

    if not include_tool_calls:
        return _text_pairs(turns)
    # What the older turns will cost as text, so the budget pays for them
    # too. Charging only the tool replay would spend everything on the newest
    # turns and leave the trim to delete the text pairs from the front — the
    # very turns this projection exists to keep.
    text_cost = [0]
    for turn in turns:
        text_cost.append(
            text_cost[-1] + count_tokens_approximately(_text_pairs([turn]))
        )
    full: list[BaseMessage] = []
    used = 0
    cut = len(turns)
    for index in range(len(turns) - 1, -1, -1):
        msgs = _turn_messages(turns[index])
        cost = count_tokens_approximately(msgs)
        # The newest turn goes in whatever it costs; the final trim and the
        # all-text fallback handle one turn too large to replay.
        if full and used + cost + text_cost[index] > max_tokens:
            break
        full = [*msgs, *full]
        used += cost
        cut = index
    return [*_text_pairs(turns[:cut]), *full]


def _trim(msgs: list[BaseMessage], max_tokens: int) -> list[BaseMessage]:
    if not msgs:
        return []
    return trim_messages(
        msgs,
        max_tokens=max_tokens,
        token_counter="approximate",
        strategy="last",
        start_on="human",
    )


def _history_chars(history: ConversationHistory) -> int:
    """Rough size of a stored conversation, in characters.

    Counts the text of every message a turn holds, tool results included,
    which is where the bytes are. `str()` on list content is close enough for
    a memory bound and costs no serialization.
    """

    total = len(history.summary or "")
    for turn in history.turns:
        total += len(turn.user_message) + len(turn.assistant_answer)
        for msg in turn.messages:
            total += len(str(msg.content))
            # Tool-call arguments live beside the content and can be the
            # larger half of the message: a query string is held here, not
            # in `content`.
            calls = getattr(msg, "tool_calls", None)
            if calls:
                total += len(json.dumps(calls, default=str))
    return total


def _summary_message(summary: str) -> HumanMessage:
    return HumanMessage(content=f"Earlier in this conversation (summary): {summary}")
