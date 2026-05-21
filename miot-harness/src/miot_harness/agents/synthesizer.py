"""Synthesizer (Sonnet tier).

Produces the final user-facing answer. Three modes:

  1. Failure mode: state['failure'] is set → render a graceful
     refusal locally (no LLM call). Cheaper, deterministic.
  2. Tenant refusal: ctx.tenant_id != 'mintral' AND no evidence →
     render the canonical "Coordinador is Mintral-only" line.
     Defense-in-depth; tenant_gate_node should have caught this
     earlier in the graph.
  3. Normal: format primer + evidence, ask the model for prose
     that cites refreshed_at and flags stale data.

Always emits an `answer.completed` event with the final text.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage

from miot_harness.config import HarnessSettings
from miot_harness.integrations.nexo.primer import COORDINADOR_PRIMER
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.plan import NexoEvidence
from miot_harness.runtime.tool import Progress

logger = logging.getLogger(__name__)


def _tenant_refusal(tenant_lock: str) -> str:
    label = tenant_lock.capitalize() if tenant_lock else "the locked tenant"
    return f"Coordinador is {label}-only. I can't answer for other tenants."


_SYNTH_SYSTEM_TEMPLATE = """\
You are the Coordinador synthesizer. Write the final answer for the user
in the same language as their question. Be concise (≤200 words).

{primer}

Rules:
- Cite refreshed_at from the evidence (timestamp + "datos del snapshot ...").
- If any evidence has is_stale=true, say so explicitly ("datos antiguos").
- If the evidence is empty or insufficient, say what you don't know.
- Do not invent rows or numbers; quote what's in the evidence.
- Do not mention internal pipeline (filter_expert, plan, etc.).
"""


_SNAPSHOT_STALE_PREFIX = "Coordinador snapshot is stale"
_SNAPSHOT_AGE_RE = re.compile(r"\(age\s*(\d+)\s*min")


def _render_failure(reason: str) -> str:
    """Render a graceful refusal for the user (Spanish, user-facing).

    The previous copy unconditionally suggested waiting for a fresh
    snapshot, which was misleading whenever the failure was not
    freshness-related (planning errors, tool errors, permission denials).
    We now route by reason category:

    - Snapshot stale → render the freshness retry advice in Spanish.
      The internal `reason` text (which is in English, formatted by
      `freshness_judge`) is NOT shown to the user; the age in minutes is
      parsed out so the user-facing message stays in one language.
    - Anything else → a neutral planning copy that nudges the user to
      reformulate. Internal `reason` text (e.g. "filter_expert returned
      malformed step") is intentionally hidden — it leaks pipeline
      structure with no user value.
    """
    if reason.startswith(_SNAPSHOT_STALE_PREFIX):
        m = _SNAPSHOT_AGE_RE.search(reason)
        if m:
            age = m.group(1)
            return (
                f"No puedo responder ahora mismo: el snapshot tiene {age} minutos. "
                "Vuelve a intentarlo cuando esté fresco o consulta con operaciones."
            )
        # Fallback if `reason` format ever changes in the upstream node —
        # still Spanish, no English leakage.
        return (
            "No puedo responder ahora mismo: el snapshot está desactualizado. "
            "Vuelve a intentarlo cuando esté fresco o consulta con operaciones."
        )
    return (
        "No pude planificar la consulta; "
        "reformúlala con más detalle o pide ayuda al equipo."
    )


def _render_evidence_for_synth(evidence: list[NexoEvidence]) -> str:
    if not evidence:
        return "(sin evidencia)"
    lines: list[str] = []
    for ev in evidence:
        refreshed = ev.refreshed_at.isoformat() if ev.refreshed_at else "unknown"
        stale = " STALE" if ev.is_stale else ""
        snippet = json.dumps(ev.output, default=str)[:1200]
        lines.append(
            f"tool={ev.tool} source={ev.source} refreshed_at={refreshed}{stale}\n  {snippet}"
        )
    return "\n".join(lines)


def _emit(progress: Progress, run_id: str, answer: str) -> None:
    progress(
        HarnessEvent(
            run_id=run_id,
            type="answer.completed",
            message="Synthesized final answer",
            data={"length": len(answer)},
        )
    )


async def synthesizer_node(
    state: dict[str, Any],
    *,
    model: BaseChatModel,
    progress: Progress,
    settings: HarnessSettings | None = None,
) -> dict[str, Any]:
    ctx: HarnessContext = state["ctx"]
    failure = state.get("failure")
    evidence: list[NexoEvidence] = list(state.get("evidence", []))
    tenant_lock = settings.nexo_tenant_lock if settings is not None else "mintral"

    if failure:
        answer = _render_failure(failure)
        _emit(progress, ctx.run_id, answer)
        return {"answer": answer}

    if ctx.tenant_id != tenant_lock and not evidence:
        refusal = _tenant_refusal(tenant_lock)
        _emit(progress, ctx.run_id, refusal)
        return {"answer": refusal}

    user_message = state.get("user_message", "")
    system = _SYNTH_SYSTEM_TEMPLATE.format(primer=COORDINADOR_PRIMER)
    rendered = _render_evidence_for_synth(evidence)
    human = f"User question:\n{user_message}\n\nEvidence:\n{rendered}\n\nWrite the answer."

    # Prior turns (when conversation_id is set) sit between the system
    # prompt and the current evidence-bearing human message so the
    # synthesizer can reference earlier facts ("as we saw last turn …")
    # per plan 13 §E5 hydration.
    prior_messages = state.get("prior_messages") or []
    messages: list[BaseMessage] = [SystemMessage(content=system)]
    messages.extend(prior_messages)
    messages.append(HumanMessage(content=human))
    response = await model.ainvoke(messages)
    text = response.content if hasattr(response, "content") else str(response)
    if not isinstance(text, str):
        text = str(text)
    answer = text.strip() or "(sin respuesta)"

    _emit(progress, ctx.run_id, answer)
    return {"answer": answer}
