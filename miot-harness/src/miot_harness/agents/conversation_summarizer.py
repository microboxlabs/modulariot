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

import json
from collections.abc import Awaitable
from typing import Protocol

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)

from miot_harness.runtime.context import MAX_CONVERSATION_SUMMARY_CHARS
from miot_harness.runtime.conversation import ConversationHistory


class ConversationSummarizer(Protocol):
    """Writes the summary of a history. `focus` is what the user asked the
    summary to keep (`/compact <focus>`)."""

    def __call__(
        self, history: ConversationHistory, *, focus: str | None = None
    ) -> Awaitable[str]: ...


# Enough to carry entities, figures, the queries behind them and open
# threads, small enough that it costs little against the hydration budget.
_MAX_SUMMARY_WORDS = 300

# Keeps one runaway answer from crowding the rest of the history out of the
# summarizer's own prompt.
_MAX_TURN_CHARS = 4_000
_MAX_TOOL_ARGS_CHARS = 600
_MAX_TOOL_RESULT_CHARS = 300

_SYSTEM_PROMPT = f"""\
You compress the earlier part of a chat between a user and an operational \
data assistant, so the assistant keeps its memory after the transcript is \
trimmed.

Write at most {_MAX_SUMMARY_WORDS} words, in the language the user wrote \
in. Keep: what the user is trying to do, the entities and figures already \
established (ids, names, dates, counts), which tools and tables produced \
them and with which filters, decisions taken, and questions still open. \
Drop greetings, pleasantries and restatements. If an earlier summary is \
given, fold it in rather than repeating it. Output the summary only.
"""


def build_conversation_summarizer(model: BaseChatModel) -> ConversationSummarizer:
    async def summarize(history: ConversationHistory, *, focus: str | None = None) -> str:
        prompt = render_history(history)
        if focus:
            prompt = f"{prompt}\n\nThe user asked the summary to keep: {focus}"
        response = await model.ainvoke(
            [
                SystemMessage(content=_SYSTEM_PROMPT),
                HumanMessage(content=prompt),
            ]
        )
        text = response.content if hasattr(response, "content") else str(response)
        text = (text if isinstance(text, str) else str(text)).strip()
        if not text:
            # Folding turns into nothing loses them; the store keeps them
            # and the next run tries again.
            raise ValueError("conversation summarizer returned nothing")
        # The caller replays the summary under the request's limit; a
        # model that ignores the word cap must not produce one it cannot.
        return text[:MAX_CONVERSATION_SUMMARY_CHARS]

    return summarize


def render_history(history: ConversationHistory) -> str:
    parts: list[str] = []
    if history.summary:
        parts.append(f"Earlier summary:\n{history.summary}")
    for turn in history.turns:
        lines = [f"User: {_clip(turn.user_message)}"]
        lines.extend(_tool_lines(turn.messages))
        lines.append(f"Assistant: {_clip(turn.assistant_answer)}")
        parts.append("\n".join(lines))
    return "\n\n".join(parts)


def _tool_lines(messages: tuple[BaseMessage, ...]) -> list[str]:
    """Each tool call a turn made, with its arguments, and each result head."""
    lines: list[str] = []
    for msg in messages:
        if isinstance(msg, AIMessage):
            for call in msg.tool_calls:
                args = json.dumps(call.get("args") or {}, ensure_ascii=False, default=str)
                lines.append(f"Tool call: {call.get('name')}({_clip(args, _MAX_TOOL_ARGS_CHARS)})")
        elif isinstance(msg, ToolMessage):
            content = msg.content
            if not isinstance(content, str):
                content = json.dumps(content, default=str)
            lines.append(f"Tool result: {_clip(content, _MAX_TOOL_RESULT_CHARS)}")
    return lines


def _clip(text: str, limit: int = _MAX_TURN_CHARS) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + " […]"
