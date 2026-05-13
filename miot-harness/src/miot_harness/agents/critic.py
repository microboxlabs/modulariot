"""Critic agent (Sonnet tier; wired but off by default).

When `settings.nexo_critic_enabled` is False, the node is a no-op.
When enabled, it asks the model whether the synthesizer's answer
adequately cites refreshed_at, flags stale data, and avoids
hallucination. v1 surfaces concerns into state but does not loop
the synthesizer — turning that on is a follow-up once we have
observed traffic.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from miot_harness.config import HarnessSettings

logger = logging.getLogger(__name__)


_CRITIC_SYSTEM = """\
You are the Coordinador critic. Inspect the proposed answer against the
collected evidence. Output ONLY a JSON object:
{"verdict": "pass" | "fail", "concerns": "..."}
Fail if the answer:
- invents numbers not in the evidence,
- omits refreshed_at when the evidence has it,
- claims data is fresh when is_stale=true,
- answers a non-Mintral question with anything other than "Mintral-only".
"""


async def critic_node(
    state: dict[str, Any],
    *,
    settings: HarnessSettings,
    model: BaseChatModel,
) -> dict[str, Any]:
    if not settings.nexo_critic_enabled:
        return {}

    answer = state.get("answer", "")
    if not answer:
        return {}

    user_message = state.get("user_message", "")
    evidence = state.get("evidence", [])
    rendered = json.dumps(
        [e.model_dump() if hasattr(e, "model_dump") else e for e in evidence], default=str
    )[:2000]
    human = f"User question: {user_message}\n\nProposed answer:\n{answer}\n\nEvidence:\n{rendered}"

    response = await model.ainvoke(
        [
            SystemMessage(content=_CRITIC_SYSTEM),
            HumanMessage(content=human),
        ]
    )
    text = response.content if hasattr(response, "content") else str(response)
    if not isinstance(text, str):
        text = str(text)

    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("critic: unparseable response: %r", text[:200])
        return {}

    if payload.get("verdict") == "fail":
        return {"critic_concerns": payload.get("concerns", "")}
    return {}
