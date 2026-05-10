"""Summarizer (Haiku tier).

When the running transcript exceeds 10 messages, this node compresses
it into a single system-style summary plus the most recent user
message — so the planner/analyst still see the latest context but the
prompt budget stays bounded.

In v1 this is mostly defensive plumbing; the staged Option C graph
keeps `messages` short by design (each agent does its own LLM call
without accumulating chat turns). It pays off if/when the loop is
extended with multi-turn user follow-ups.
"""

from __future__ import annotations

from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

_SUMMARIZE_THRESHOLD = 10


_SUMMARIZER_SYSTEM = """\
You compress conversation history for an operational analytics agent.
Output a single paragraph (≤80 words) preserving:
- the user's underlying question,
- key facts or constraints already established,
- which tools have been run and what they returned at a high level.
Drop chit-chat, repeated phrasing, and pleasantries.
"""


async def summarizer_node(
    state: dict[str, Any],
    *,
    model: BaseChatModel,
) -> dict[str, Any]:
    messages = list(state.get("messages") or [])
    if len(messages) <= _SUMMARIZE_THRESHOLD:
        return {}

    rendered = "\n".join(f"- [{m.get('role')}] {m.get('content', '')}" for m in messages[:-1])
    response = await model.ainvoke(
        [
            SystemMessage(content=_SUMMARIZER_SYSTEM),
            HumanMessage(content=rendered),
        ]
    )
    text = response.content if hasattr(response, "content") else str(response)
    if not isinstance(text, str):
        text = str(text)

    summary_msg = {"role": "system", "content": f"Summary so far: {text.strip()}"}
    last_msg = messages[-1]
    return {"messages": [summary_msg, last_msg]}
