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
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from miot_harness.integrations.nexo.primer import COORDINADOR_PRIMER
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.plan import NexoEvidence
from miot_harness.runtime.tool import Progress

logger = logging.getLogger(__name__)

_TENANT_REFUSAL = "Coordinador is Mintral-only. I can't answer for other tenants."


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


def _render_failure(reason: str) -> str:
    return (
        f"No puedo responder ahora mismo: {reason} "
        "Reintenta cuando el snapshot esté fresco o consulta con operaciones."
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
) -> dict[str, Any]:
    ctx: HarnessContext = state["ctx"]
    failure = state.get("failure")
    evidence: list[NexoEvidence] = list(state.get("evidence", []))

    if failure:
        answer = _render_failure(failure)
        _emit(progress, ctx.run_id, answer)
        return {"answer": answer}

    if ctx.tenant_id != "mintral" and not evidence:
        _emit(progress, ctx.run_id, _TENANT_REFUSAL)
        return {"answer": _TENANT_REFUSAL}

    user_message = state.get("user_message", "")
    system = _SYNTH_SYSTEM_TEMPLATE.format(primer=COORDINADOR_PRIMER)
    rendered = _render_evidence_for_synth(evidence)
    human = (
        f"User question:\n{user_message}\n\nEvidence:\n{rendered}\n\nWrite the answer."
    )

    response = await model.ainvoke([
        SystemMessage(content=system),
        HumanMessage(content=human),
    ])
    text = response.content if hasattr(response, "content") else str(response)
    if not isinstance(text, str):
        text = str(text)
    answer = text.strip() or "(sin respuesta)"

    _emit(progress, ctx.run_id, answer)
    return {"answer": answer}
