"""What the harness does with the model's final answer.

A JSON-blocks answer (the miot-search skill) is repaired into valid blocks,
and the `assumption` blocks in it are surfaced as grounding gaps.
"""

from __future__ import annotations

import json
from typing import Any

from json_repair import repair_json

from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.tool import Progress


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

    Only answers that begin with ``[`` (the block format) are touched; prose
    passes through unchanged.
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


def extract_assumptions(answer: str) -> list[dict[str, Any]]:
    """Pull self-reported ground-or-flag assumptions out of a JSON-blocks answer.

    The answering agent (guided by the miot-search skill's assumptions
    contract) emits one `{"type":"assumption","value":{term,interpretation,
    predicate}}` block per business term it could not ground in an
    authoritative card. A non-JSON or block-less answer yields nothing."""
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


def emit_grounding_gap(
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
