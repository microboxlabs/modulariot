"""Background knowledge distiller — the DISTILL stage of the learning loop.

Off the request hot path, a reflector reads a batch of interaction episodes for
one tenant+connection and distills recurring business-semantics facts into
CANDIDATE cards (Reflexion / ExpeL-style natural-language distillation over
trajectories). Candidates are never authoritative — they land in the
human-gated R2 staging store, and only a human promotion writes an authored
card. This module owns the host-agnostic distillation LOGIC (episodes in, typed
candidates out); how episodes are fetched and candidates persisted is wired by
the caller (see the R3 design — the harness has no DB of its own).

Degrades safely: with no model wired it distills nothing (returns `[]`), exactly
like the verifier's rules-only mode — so the pipeline is safe by construction.

The highest-value signal in an episode is the agent's own **ground-or-flag
assumption** (R0): a term the agent had to GUESS. A term that recurs as an
ungrounded assumption across sessions is precisely what needs an authoritative
definition — so the distiller reflects over those, and grounds each candidate's
provenance in the real `run_id`s that raised it (never LLM-invented).
"""

from __future__ import annotations

import json
import logging
from collections.abc import Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from miot_harness.agents.chat_models import response_text
from miot_harness.agents.filter_expert import _strip_fences

logger = logging.getLogger(__name__)

# A candidate's `kind` mirrors the authored-card taxonomy (models.py / DESIGN §11).
_KINDS = frozenset({"term", "stage", "metric", "entity", "recipe", "gotcha"})


@dataclass(frozen=True)
class CandidateFact:
    """One distilled candidate business fact, staged for the human gate.

    `body` is the MEANING of `term` (a predicate template, e.g. "entregas =
    task_def_key in (confirmDelivery, receiveDelivery)"), never row-level data —
    the security invariant is enforced downstream by the writer + safety rails.
    `provenance` records the real episodes that support it: {run_ids, evidence}.
    """

    connection: str
    term: str
    body: str
    kind: str = "term"
    scope: str = "tenant"
    confidence: float | None = None
    provenance: dict[str, Any] = field(default_factory=dict)


_DISTILLER_SYSTEM = """\
You distill durable business-vocabulary facts from a data assistant's own
sessions. You are given a batch of interaction episodes for ONE data connection.
Each episode may carry the assistant's declared ASSUMPTIONS: business terms it
had to GUESS because no authoritative definition existed (grounded=false).

Your job: find terms that RECUR as ungrounded guesses (or that a user corrected)
and propose, for each, one candidate definition the team could approve.

Rules:
- Propose a term ONLY if it appears in >=1 ungrounded assumption in the batch.
  Skip terms listed as ALREADY DEFINED.
- `body` states the term's MEANING as a reusable predicate/template (e.g.
  "entregas = task_def_key in ('confirmDelivery','receiveDelivery'); excludes
  confirmArrival"). NEVER put concrete row values (ids, names, phones, emails)
  in the body — a shared fact is meaning, not data.
- `confidence` in [0,1] reflects how consistently the episodes support the
  reading (one weak guess = low; a correction or repeated agreement = high).
- Prefer the interpretation the assistant already flagged unless the episodes
  contradict it.

Return ONLY a JSON array (possibly empty), each item:
{"term": "<term>", "kind": "term|stage|metric|entity|recipe|gotcha",
 "body": "<meaning>", "confidence": <0..1>}
No prose before or after the array.
"""


def _as_mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _iter_ungrounded_assumptions(
    episode: Mapping[str, Any], *, connection: str
) -> Iterator[Mapping[str, Any]]:
    """Yield the episode's ungrounded assumptions for `connection`. An assumption
    with no connection stamp is treated as belonging to the current one (older
    episodes predate the R2c-3 stamp)."""
    payload = _as_mapping(episode.get("payload"))
    raw = payload.get("assumptions")
    if not isinstance(raw, Sequence) or isinstance(raw, (str, bytes)):
        return
    for item in raw:
        a = _as_mapping(item)
        if not a.get("term"):
            continue
        if a.get("grounded") is True:
            continue
        conn = a.get("connection")
        if conn and str(conn) != connection:
            continue
        yield a


def _supporting_runs(
    term: str, episodes: Iterable[Mapping[str, Any]], *, connection: str
) -> tuple[list[str], int]:
    """The real episode `run_id`s whose ungrounded assumptions name `term`
    (case-insensitive) — so a candidate's provenance is grounded in evidence,
    not the model's word. Returns (ordered unique run_ids, evidence count)."""
    key = term.strip().casefold()
    run_ids: list[str] = []
    seen: set[str] = set()
    count = 0
    for ep in episodes:
        hit = any(
            str(a.get("term", "")).strip().casefold() == key
            for a in _iter_ungrounded_assumptions(ep, connection=connection)
        )
        if not hit:
            continue
        count += 1
        run_id = ep.get("run_id")
        if isinstance(run_id, str) and run_id and run_id not in seen:
            seen.add(run_id)
            run_ids.append(run_id)
    return run_ids, count


def _coerce_confidence(value: Any) -> float | None:
    """Confidence normalized to [0,1], or None when unparseable — a bad number
    must never make a candidate look more (or less) certain than the evidence."""
    if value is None or isinstance(value, bool):
        return None
    try:
        num = float(value)
    except (TypeError, ValueError):
        return None
    return max(0.0, min(1.0, num))


def parse_candidates(
    raw: Any, *, connection: str, episodes: Sequence[Mapping[str, Any]] = ()
) -> list[CandidateFact]:
    """Validate the reflector's JSON into typed `CandidateFact`s, dropping any
    malformed item (missing term/body). Deterministic and model-free, so the
    output-shape contract is unit-testable. When `episodes` are given, each
    candidate's provenance is filled from the real supporting `run_id`s."""
    if not isinstance(raw, Sequence) or isinstance(raw, (str, bytes)):
        return []
    out: list[CandidateFact] = []
    for item in raw:
        m = _as_mapping(item)
        term = str(m.get("term") or "").strip()
        body = str(m.get("body") or "").strip()
        if not term or not body:
            continue
        kind = str(m.get("kind") or "term").strip().lower()
        if kind not in _KINDS:
            kind = "term"
        run_ids, evidence = _supporting_runs(term, episodes, connection=connection)
        provenance: dict[str, Any] = {"run_ids": run_ids, "evidence": evidence}
        out.append(
            CandidateFact(
                connection=connection,
                term=term,
                body=body,
                kind=kind,
                confidence=_coerce_confidence(m.get("confidence")),
                provenance=provenance,
            )
        )
    return out


def _load_array(text: str) -> Any:
    """Parse the reflector's answer into a JSON value. Tolerant of code fences;
    a leading non-JSON preamble or a hard parse failure yields None (→ no
    candidates), never an exception that would trap the background pass."""
    stripped = _strip_fences(text)
    try:
        return json.loads(stripped)
    except (ValueError, TypeError):
        return None


def _render_episodes(
    episodes: Sequence[Mapping[str, Any]], *, connection: str
) -> str:
    lines: list[str] = []
    for ep in episodes:
        payload = _as_mapping(ep.get("payload"))
        query = str(payload.get("query") or "").strip()
        signal = str(ep.get("signal") or "").strip()
        assumptions = [
            f"{a.get('term')}={a.get('interpretation') or a.get('predicate') or '?'}"
            for a in _iter_ungrounded_assumptions(ep, connection=connection)
        ]
        if not query and not assumptions:
            continue
        head = f"- query={query!r}"
        if signal:
            head += f" signal={signal}"
        if assumptions:
            head += "\n    guessed: " + "; ".join(assumptions)
        lines.append(head)
    return "\n".join(lines) if lines else "(no ungrounded terms in this batch)"


async def distill_episodes(
    episodes: Sequence[Mapping[str, Any]],
    *,
    connection: str,
    model: BaseChatModel | None,
    existing_terms: Iterable[str] = (),
) -> list[CandidateFact]:
    """Reflect over `episodes` for `connection` and return candidate facts.

    Returns `[]` when no model is wired or the batch carries no ungrounded terms
    (nothing to learn) — the same rules-only degradation as the verifier, so a
    background pass is safe to run even before a distiller model is configured.
    Any reflector error is swallowed to `[]`: the background pass must never
    crash the process it runs in.
    """
    if model is None or not episodes:
        return []
    # A generator object is always truthy — iterate to test for a real yield.
    has_ungrounded = any(
        True
        for ep in episodes
        for _ in _iter_ungrounded_assumptions(ep, connection=connection)
    )
    if not has_ungrounded:
        return []

    defined = sorted({t.strip() for t in existing_terms if t and t.strip()})
    human = (
        f"Connection: {connection}\n\n"
        f"ALREADY DEFINED (skip these): {', '.join(defined) or '(none)'}\n\n"
        f"Episodes:\n{_render_episodes(episodes, connection=connection)}\n\n"
        "Distill the recurring ungrounded terms into candidate definitions."
    )
    try:
        response = await model.ainvoke(
            [SystemMessage(content=_DISTILLER_SYSTEM), HumanMessage(content=human)]
        )
        raw = _load_array(response_text(response))
    except Exception as exc:  # noqa: BLE001 — a background pass must never crash
        logger.warning("distiller: reflection failed (%s); no candidates", exc)
        return []

    candidates = parse_candidates(raw, connection=connection, episodes=episodes)
    # Defensively drop anything the model proposed for an already-defined term,
    # even though the prompt asks it not to (the human gate is not the only guard).
    defined_keys = {t.casefold() for t in defined}
    return [c for c in candidates if c.term.casefold() not in defined_keys]
