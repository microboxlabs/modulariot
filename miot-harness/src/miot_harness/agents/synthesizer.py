"""Synthesizer (Sonnet tier).

Produces the final user-facing answer. Three modes:

  1. Failure mode: state['failure'] is set → render a graceful
     refusal locally (no LLM call). Cheaper, deterministic.
  2. Tenant refusal: ctx.tenant_id is off the datasource lock AND no
     evidence → render the canonical "<datasource> is <tenant>-only" line
     from the profile template. Defense-in-depth; tenant_gate_node should
     have caught this earlier in the graph.
  3. Normal: format primer + evidence, ask the model for prose
     that cites refreshed_at and flags stale data.

Always emits an `answer.completed` event with the final text.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from json_repair import repair_json
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage

from miot_harness.agents.llm_streaming import stream_llm_with_thinking
from miot_harness.config import HarnessSettings
from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.plan import DataEvidence
from miot_harness.runtime.tool import Progress

logger = logging.getLogger(__name__)


def _tenant_refusal(profile: DataSourceProfile, tenant_lock: str) -> str:
    # Render the canonical refusal from the profile template. The lock is
    # capitalized (e.g. "<Tenant>-only"); display_name comes straight from
    # the profile.
    label = tenant_lock.capitalize() if tenant_lock else "the locked tenant"
    return profile.tenant_refusal_template.format(
        display_name=profile.display_name, lock=label
    )


# Freshness guidance for SNAPSHOT datasources (Nexo's fn_dx_* tables). Omitted
# for live sources, which have no snapshot/refresh model.
_SYNTH_FRESHNESS_RULES = """\
- Cite refreshed_at from the evidence (timestamp + "datos del snapshot ...").
- If any evidence has is_stale=true, say so explicitly ("datos antiguos").

Per-status phrasing (each evidence line carries status=... and rows=...):
- status=empty → the snapshot IS fresh but the filter matched nothing:
  say "no hay filas que coincidan con esos filtros (snapshot del <ts>)".
  Never present this as stale data.
- status=stale → cite the snapshot age explicitly ("datos antiguos").
- status=no_timestamp → data came back without a refresh timestamp:
  say "datos sin marca de tiempo de actualización — trátalos con cautela".
- status=empty_no_timestamp → no rows AND no timestamp; the view looks
  unrefreshed: say "esta vista parece no haberse refrescado; no puedo
  distinguir 'sin datos' de 'snapshot vacío'"."""

# Guidance for LIVE datasources (generic pg): current data, no snapshot model.
_SYNTH_LIVE_RULES = """\
- This is a LIVE datasource: the evidence is the current state. Do NOT add
  freshness/snapshot/timestamp caveats and do NOT treat a missing refresh
  timestamp as staleness. status=empty just means no rows matched."""


# {display_name} → profile.display_name; {freshness_rules} → snapshot-vs-live.
_SYNTH_SYSTEM_TEMPLATE = """\
You are the {display_name} synthesizer. Write the final answer for the user
in the same language as their question. Be concise (≤200 words).

{primer}

Rules:
- If the evidence is empty or insufficient, say what you don't know.
- Do not invent rows or numbers; quote what's in the evidence.
- Do not mention internal pipeline (filter_expert, plan, etc.).
- When asked what query you ran, quote the `executed_sql` of the relevant
  evidence line verbatim. Never invent, guess, or paraphrase a query you did
  not run; if no evidence line carries executed_sql, say you don't have it.
- Evidence flagged SAMPLE is a fuzzy ILIKE/grep search — illustrative only.
  Never report its row count as a total or present it as a complete list. Any
  count or total MUST come from an aggregate/COUNT result, not from counting
  sample rows.
- Do not pad the answer with attributes or values that are not in the evidence.
{freshness_rules}
"""


def _snapshot_stale_prefix(profile: DataSourceProfile) -> str:
    # Must match the prefix freshness_judge emits: f"{display_name} snapshot
    # is stale" — display_name is the active datasource's human name.
    return f"{profile.display_name} snapshot is stale"


_SNAPSHOT_AGE_RE = re.compile(r"\(age\s*(\d+)\s*min")

# Failure reasons produced by a PLANNER seat that couldn't turn the user's
# message into a tool call (vs. a tool that ran and broke). Only these get
# the capabilities-list fallback — after a tool crash, "here's what I can
# do" would be misleading.
_PLANNING_FAILURE_PREFIXES = ("filter_expert", "agentic planner")


def _render_failure(
    reason: str,
    *,
    snapshot_stale_prefix: str,
    capabilities_hint: str | None = None,
) -> str:
    """Render a graceful refusal for the user (Spanish, user-facing).

    Routed by reason category:

    - Snapshot stale → render the freshness retry advice in Spanish.
      The internal `reason` text (which is in English, formatted by
      `freshness_judge`) is NOT shown to the user; the age in minutes is
      parsed out so the user-facing message stays in one language.
    - Planning failure + capabilities_hint → onboarding fallback: list
      what the datasource CAN answer instead of asking the user to
      rephrase into the void (Gap 4 — meta-questions in canned mode).
    - Anything else → a neutral copy that nudges the user to
      reformulate. Internal `reason` text (e.g. "filter_expert returned
      malformed step") is intentionally hidden — it leaks pipeline
      structure with no user value.
    """
    if reason.startswith(snapshot_stale_prefix):
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
    if capabilities_hint and reason.startswith(_PLANNING_FAILURE_PREFIXES):
        return (
            "No pude convertir tu pregunta en una consulta de datos. "
            "Esto es lo que puedo consultar:\n"
            f"{capabilities_hint}\n"
            "Pídeme cualquiera de estos temas o haz una pregunta más específica."
        )
    return (
        "No pude planificar la consulta; "
        "reformúlala con más detalle o pide ayuda al equipo."
    )


def render_failure(
    reason: str,
    *,
    profile: DataSourceProfile,
    capabilities_hint: str | None = None,
) -> str:
    """Public seam for other graphs (agentic) to render the same graceful
    Spanish refusals without re-deriving the stale-snapshot prefix."""
    return _render_failure(
        reason,
        snapshot_stale_prefix=_snapshot_stale_prefix(profile),
        capabilities_hint=capabilities_hint,
    )


def _render_evidence_for_synth(evidence: list[DataEvidence]) -> str:
    if not evidence:
        return "(sin evidencia)"
    lines: list[str] = []
    for ev in evidence:
        refreshed = ev.refreshed_at.isoformat() if ev.refreshed_at else "unknown"
        stale = " STALE" if ev.is_stale else ""
        # SAMPLE flags fuzzy grep/ILIKE evidence — illustrative, never a total.
        sample = " SAMPLE" if ev.is_sample else ""
        snippet = json.dumps(ev.output, default=str)[:1200]
        header = (
            f"tool={ev.tool} source={ev.source} refreshed_at={refreshed}{stale}{sample} "
            f"status={ev.freshness_status} rows={ev.sample_size}"
        )
        # The exact SQL that ran (when the tool ran one): the synthesizer quotes
        # this verbatim if asked what query produced the answer.
        if ev.executed_sql:
            header += f"\n  executed_sql: {ev.executed_sql[:600]}"
        lines.append(f"{header}\n  {snippet}")
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


def _lenient_load(text: str) -> Any:
    """Parse `text` as JSON, repairing common LLM malformations (unescaped inner
    quotes, trailing commas) via json-repair when strict parsing fails. Returns
    None when even the repair can't produce JSON."""
    try:
        return json.loads(text)
    except (ValueError, TypeError):
        pass
    try:
        return json.loads(repair_json(text))
    except (ValueError, TypeError):
        return None


def _coerce_blocks(answer: str) -> list[dict[str, Any]] | None:
    """Recover the typed-block array from a (possibly malformed) block answer,
    unwrapping the double-wrap failure mode — the whole array nested as a string
    inside a lone markdown block. Returns None when nothing block-like survives."""
    parsed = _lenient_load(answer)
    if not isinstance(parsed, list):
        return None
    if (
        len(parsed) == 1
        and isinstance(parsed[0], dict)
        and parsed[0].get("type") == "markdown"
    ):
        inner = _lenient_load(str(parsed[0].get("value", "")))
        if isinstance(inner, list) and any(
            isinstance(b, dict) and "type" in b for b in inner
        ):
            parsed = inner
    blocks = [
        b for b in parsed if isinstance(b, dict) and isinstance(b.get("type"), str)
    ]
    return blocks or None


def harden_answer(answer: str) -> str:
    """Return a guaranteed-valid JSON-blocks answer for the block-format skills
    (miot-search), repairing the two observed LLM failure modes: unescaped inner
    quotes (invalid JSON) and double-wrapping (the array nested as a string in one
    markdown block). Both otherwise break the client's block rendering AND the
    server's assumption extraction (the elicit chip).

    Self-gating: only answers that begin with ``[`` (the block format) are
    touched — prose refusals and non-JSON synthesis paths pass through unchanged.
    A block-format answer that can't be salvaged is wrapped as one markdown block
    so the client renders text, never a raw JSON dump."""
    if not answer.lstrip().startswith("["):
        return answer
    blocks = _coerce_blocks(answer)
    if blocks is None:
        return json.dumps(
            [{"type": "markdown", "value": answer.strip()}], ensure_ascii=False
        )
    return json.dumps(blocks, ensure_ascii=False)


def _extract_assumptions(answer: str) -> list[dict[str, Any]]:
    """Pull self-reported ground-or-flag assumptions out of a JSON-blocks answer.

    The synthesizer (guided by the miot-search skill's assumptions contract)
    emits one `{"type":"assumption","value":{term,interpretation,predicate}}`
    block per business term it could not ground in an authoritative card. A
    non-JSON or block-less answer yields nothing — this is a NO-OP for every
    other synthesis path (prose answers, nexo, refusals), so the shared
    synthesizer behaviour is unchanged unless a skill opts in."""
    try:
        parsed = json.loads(answer)
    except (ValueError, TypeError):
        return []
    if not isinstance(parsed, list):
        return []
    assumptions: list[dict[str, Any]] = []
    for item in parsed:
        if not isinstance(item, dict) or item.get("type") != "assumption":
            continue
        value = item.get("value")
        if not isinstance(value, dict):
            continue
        assumptions.append(
            {
                "term": str(value.get("term", "")),
                "interpretation": str(value.get("interpretation", "")),
                "predicate": str(value.get("predicate", "")),
                "grounded": False,
            }
        )
    return assumptions


def _emit_grounding_gap(
    progress: Progress, run_id: str, assumption: dict[str, Any]
) -> None:
    progress(
        HarnessEvent(
            run_id=run_id,
            type="grounding.gap",
            message=f"Ungrounded business term: {assumption.get('term') or '?'}",
            data=assumption,
        )
    )


async def synthesizer_node(
    state: dict[str, Any],
    *,
    model: BaseChatModel,
    progress: Progress,
    profile: DataSourceProfile,
    settings: HarnessSettings | None = None,
    extra_system_rules: str | None = None,
    capabilities_hint: str | None = None,
) -> dict[str, Any]:
    ctx: HarnessContext = state["ctx"]
    failure = state.get("failure")
    evidence: list[DataEvidence] = list(state.get("evidence", []))
    # Effective lock: env override wins, else the profile's lock.
    tenant_lock = (
        settings.datasource_tenant_lock if settings is not None else None
    ) or profile.tenant_lock

    if failure:
        answer = _render_failure(
            failure,
            snapshot_stale_prefix=_snapshot_stale_prefix(profile),
            capabilities_hint=capabilities_hint,
        )
        _emit(progress, ctx.run_id, answer)
        return {"answer": answer}

    if tenant_lock is not None and ctx.tenant_id != tenant_lock and not evidence:
        refusal = _tenant_refusal(profile, tenant_lock)
        _emit(progress, ctx.run_id, refusal)
        return {"answer": refusal}

    user_message = state.get("user_message", "")
    system = _SYNTH_SYSTEM_TEMPLATE.format(
        display_name=profile.display_name,
        primer=profile.primer,
        freshness_rules=(
            _SYNTH_FRESHNESS_RULES
            if profile.has_freshness_model
            else _SYNTH_LIVE_RULES
        ),
    )
    if extra_system_rules:
        system = f"{system}\n{extra_system_rules}"
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

    stream_enabled = bool(settings and settings.agents_synthesizer_stream)
    if stream_enabled:
        answer = await stream_llm_with_thinking(
            model=model,
            messages=messages,
            progress=progress,
            run_id=ctx.run_id,
            agent_name="synthesizer",
        )
        if not answer:
            answer = "(sin respuesta)"
    else:
        response = await model.ainvoke(messages)
        text = response.content if hasattr(response, "content") else str(response)
        if not isinstance(text, str):
            text = str(text)
        answer = text.strip() or "(sin respuesta)"

    # Guarantee a valid JSON-blocks answer (block-format skills only): repairs the
    # LLM's unescaped-quote / double-wrap slips so the client renders blocks and
    # the assumption extraction below sees the ground-or-flag blocks. No-op for
    # prose refusals and non-JSON answers.
    answer = harden_answer(answer)

    _emit(progress, ctx.run_id, answer)
    # Ground-or-flag: surface any self-reported assumption as a structured
    # record + one grounding.gap event per ungrounded term (no-op unless the
    # answer carried assumption blocks).
    assumptions = _extract_assumptions(answer)
    for assumption in assumptions:
        _emit_grounding_gap(progress, ctx.run_id, assumption)
    return {"answer": answer, "assumptions": assumptions}
