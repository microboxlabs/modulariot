"""Single-agent native tool-calling loop (replaces the agentic seat panel).

Cache layout per request (Anthropic renders tools → system → messages):

    [tools: sorted, static]                      ─┐ cached prefix,
    [system: frozen prompt, cache_control here]  ─┘ breakpoint 1
    [prior turns + this run's growing loop tail]
    [last block: request-time cache_control]      ← breakpoint 2

Invariants (spec 2026-07-02): the prefix is byte-stable per (profile,
registry); dynamic content (skill bodies, JSON-block contracts) rides in
the user turn as <system-reminder> blocks; markers are applied on a COPY at
request time so history never accumulates breakpoints.

Known limit (spec §component 5): the API's cache lookback is 20 content
blocks — a single turn with >8 parallel tool calls could out-run it and
silently miss the tail cache for that request (prefix cache unaffected).
Accepted for v1; revisit if usage_log shows cache_read collapsing on
fan-out turns.
"""

from __future__ import annotations

import copy
import json
import logging
from typing import Any

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)

logger = logging.getLogger(__name__)

_EPHEMERAL_CACHE = {"type": "ephemeral"}


def _split_prior(
    prior: list[BaseMessage],
) -> tuple[list[BaseMessage], list[str]]:
    """Separate supervisor-injected SystemMessages from real history.

    langchain_anthropic folds every SystemMessage into the single top-level
    `system` param — a per-request skill body appended there would change
    the cached prefix bytes and silently zero the cache. So injected system
    texts are demoted to <system-reminder> blocks in the user turn instead.
    """
    history: list[BaseMessage] = []
    reminders: list[str] = []
    for msg in prior:
        if isinstance(msg, SystemMessage):
            reminders.append(
                msg.content if isinstance(msg.content, str) else json.dumps(msg.content)
            )
        else:
            history.append(msg)
    return history, reminders


def _compose_human(user_message: str, reminders: list[str]) -> HumanMessage:
    if not reminders:
        return HumanMessage(content=user_message)
    blocks = "\n\n".join(
        f"<system-reminder>\n{text}\n</system-reminder>" for text in reminders
    )
    return HumanMessage(content=f"{blocks}\n\n{user_message}")


def _with_tail_marker(messages: list[BaseMessage]) -> list[BaseMessage]:
    """Copy of `messages` with `cache_control` on the last markable block.

    Applied per request; the caller's list is never mutated (asserted by
    tests) so breakpoints can't accumulate past the API's 4-marker cap.
    """
    if not messages:
        return messages
    last = messages[-1]
    marked = _mark_message(last)
    if marked is None:
        return list(messages)
    return [*messages[:-1], marked]


def _mark_message(msg: BaseMessage) -> BaseMessage | None:
    content = msg.content
    if isinstance(content, str):
        blocks: list[Any] = [
            {"type": "text", "text": content, "cache_control": _EPHEMERAL_CACHE}
        ]
    elif isinstance(content, list) and content:
        blocks = copy.deepcopy(content)
        tail = blocks[-1]
        if not isinstance(tail, dict):
            return None
        if tail.get("type") not in ("text", "tool_result", "tool_use"):
            # thinking / redacted blocks are not valid cache anchors — skip
            # marking rather than 400 the request.
            return None
        tail["cache_control"] = _EPHEMERAL_CACHE
    else:
        return None
    return msg.model_copy(update={"content": blocks})
