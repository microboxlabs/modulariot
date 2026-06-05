"""Domain Analyst (Sonnet tier).

Reads accumulated evidence + primer, decides whether the question is
answerable. Output is a JSON verdict:
  {"verdict": "ready" | "need_more", "reasoning": "..."}

The analyst does NOT produce the user-facing prose — that's the
synthesizer's job. Its only effect on state is `next_action`. This
keeps cost low (one short LLM call) and makes the supervisor's
routing deterministic.

If the model returns malformed output, default to
`ready_to_synthesize` so the user gets *something* — preferable to
looping or stalling.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.runtime.plan import NexoEvidence

logger = logging.getLogger(__name__)

_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL | re.IGNORECASE)


def _strip_fences(text: str) -> str:
    text = text.strip()
    match = _JSON_FENCE_RE.search(text)
    if match:
        return match.group(1).strip()
    return text


# {display_name} → profile.display_name; {tenant_display} → the tenant the
# datasource is locked to (profile.tenant_lock, capitalized); {prefix_label}
# → profile.tool_prefix + "*". Render byte-identically to the former
# hardcodes for NEXO_PROFILE ("Coordinador", "Mintral", "coordinador_*").
_ANALYST_SYSTEM_TEMPLATE = """\
You are the {display_name} Domain Analyst. Your job is to decide whether the
collected evidence is enough to answer the user's question.

You DO NOT write the final answer. The synthesizer does that.
Your only output is a JSON verdict.

{primer}

Output ONLY a JSON object:
{{"verdict": "ready" | "need_more", "reasoning": "..."}}

- "ready" means the evidence is sufficient to answer (or to refuse
  gracefully if the question is out of scope or non-{tenant_display}).
- "need_more" means another {prefix_label} tool call would help.
"""


def _render_evidence(evidence: list[NexoEvidence]) -> str:
    if not evidence:
        return "(no evidence collected yet)"
    lines: list[str] = []
    for i, ev in enumerate(evidence, start=1):
        stale = " [STALE]" if ev.is_stale else ""
        refreshed = ev.refreshed_at.isoformat() if ev.refreshed_at else "unknown"
        sample = f" sample_size={ev.sample_size}" if ev.sample_size is not None else ""
        # Cap to avoid bloating prompt
        snippet = json.dumps(ev.output, default=str)[:1000]
        lines.append(f"[{i}] tool={ev.tool} refreshed_at={refreshed}{stale}{sample}\n    {snippet}")
    return "\n".join(lines)


async def domain_analyst_node(
    state: dict[str, Any],
    *,
    model: BaseChatModel,
    profile: DataSourceProfile,
) -> dict[str, Any]:
    evidence: list[NexoEvidence] = list(state.get("evidence", []))
    if not evidence:
        # Nothing to analyze — bounce back to filter_expert via supervisor
        return {"next_action": "need_more_tools"}

    user_message = state.get("user_message", "")
    system = _ANALYST_SYSTEM_TEMPLATE.format(
        display_name=profile.display_name,
        tenant_display=(profile.tenant_lock or profile.display_name).capitalize(),
        prefix_label=f"{profile.tool_prefix}*",
        primer=profile.primer,
    )
    rendered = _render_evidence(evidence)
    human = f"User question:\n{user_message}\n\nEvidence collected so far:\n{rendered}"

    response = await model.ainvoke(
        [
            SystemMessage(content=system),
            HumanMessage(content=human),
        ]
    )
    text = response.content if hasattr(response, "content") else str(response)
    if not isinstance(text, str):
        text = str(text)

    verdict = "ready"
    reasoning = ""
    try:
        payload = json.loads(_strip_fences(text))
        if isinstance(payload, dict):
            verdict = payload.get("verdict", "ready")
            reasoning = payload.get("reasoning", "")
    except json.JSONDecodeError:
        logger.warning("domain_analyst: unparseable response: %r — defaulting to ready", text[:200])

    next_action = "need_more_tools" if verdict == "need_more" else "ready_to_synthesize"
    return {
        "next_action": next_action,
        "turn_count": int(state.get("turn_count", 0)) + 1,
        "analyst_reasoning": reasoning,
    }
