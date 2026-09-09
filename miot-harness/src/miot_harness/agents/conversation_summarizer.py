"""Conversation compaction (Haiku tier).

`ConversationStore.summarize_if_needed` folds a chat's older turns into one
`summary` string once the turn count passes the configured cap. This is
the summarizer it calls: the prior summary, if any, plus the turns about
to be compacted, rewritten as one compact paragraph.

Distinct from `agents/summarizer.py`, which compresses a single run's
tool transcript inside the data graph. That one bounds a run; this one
bounds a conversation.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from miot_harness.runtime.conversation import ConversationHistory

ConversationSummarizer = Callable[[ConversationHistory], Awaitable[str]]

# Roughly 200 words: enough to carry entities, figures and open threads,
# small enough that it costs nothing against the hydration budget.
_MAX_SUMMARY_WORDS = 200

# Keeps one runaway answer from crowding the rest of the history out of the
# summarizer's own prompt.
_MAX_TURN_CHARS = 4_000

_SYSTEM_PROMPT = f"""\
You compress the earlier part of a chat between a user and an operational \
data assistant, so the assistant keeps its memory after the transcript is \
trimmed.

Write ONE paragraph of at most {_MAX_SUMMARY_WORDS} words, in the language \
the user wrote in. Keep: what the user is trying to do, the entities and \
figures already established (ids, names, dates, counts), decisions taken, \
and questions still open. Drop greetings, pleasantries and restatements. \
If an earlier summary is given, fold it in rather than repeating it. \
Output the paragraph only.
"""


def build_conversation_summarizer(model: BaseChatModel) -> ConversationSummarizer:
    async def summarize(history: ConversationHistory) -> str:
        response = await model.ainvoke(
            [
                SystemMessage(content=_SYSTEM_PROMPT),
                HumanMessage(content=render_history(history)),
            ]
        )
        text = response.content if hasattr(response, "content") else str(response)
        text = text if isinstance(text, str) else str(text)
        # An empty answer would erase what the previous summary held.
        return text.strip() or (history.summary or "")

    return summarize


def render_history(history: ConversationHistory) -> str:
    parts: list[str] = []
    if history.summary:
        parts.append(f"Earlier summary:\n{history.summary}")
    for turn in history.turns:
        parts.append(f"User: {_clip(turn.user_message)}\nAssistant: {_clip(turn.assistant_answer)}")
    return "\n\n".join(parts)


def _clip(text: str) -> str:
    if len(text) <= _MAX_TURN_CHARS:
        return text
    return text[:_MAX_TURN_CHARS] + " […]"
