"""harden_answer repairs the LLM's block-JSON slips so the client renders blocks
and the ground-or-flag assumption survives (the spotlight elicit chip).

Two failure modes observed live against real data:
- unescaped inner quotes (`asumí que "entregas" = …`) → invalid JSON;
- double-wrapping (the whole block array nested as a string in one markdown block).
Both otherwise dump raw JSON in the UI and wipe `record.assumptions`.
"""

from __future__ import annotations

import json

from miot_harness.agents.synthesizer import (
    _extract_assumptions,
    harden_answer,
)

_CLEAN = json.dumps(
    [
        {"type": "intent", "value": "ask"},
        {"type": "markdown", "value": "Hay 9 servicios"},
        {"type": "url", "value": {"url": "/delivery", "name": "Entregas"}},
        {
            "type": "assumption",
            "value": {"term": "entregas", "interpretation": "x", "predicate": "p"},
        },
    ],
    ensure_ascii=False,
)


def _assert_valid_blocks_with_assumption(answer: str) -> None:
    parsed = json.loads(answer)  # must be valid JSON now
    assert isinstance(parsed, list)
    assumptions = _extract_assumptions(answer)
    assert [a["term"] for a in assumptions] == ["entregas"]


def test_clean_answer_stays_valid_and_keeps_assumption() -> None:
    hardened = harden_answer(_CLEAN)
    _assert_valid_blocks_with_assumption(hardened)


def test_unescaped_inner_quotes_are_repaired() -> None:
    # The markdown prose embeds a double-quoted term without escaping → invalid.
    broken = (
        '[{"type": "markdown", "value": "Hay 11 (asumí que "entregas" = tareas)"}, '
        '{"type": "assumption", "value": {"term": "entregas", '
        '"interpretation": "x", "predicate": "p"}}]'
    )
    # Precondition: the raw answer is genuinely invalid JSON.
    try:
        json.loads(broken)
        raise AssertionError("fixture should be invalid JSON")
    except ValueError:
        pass
    hardened = harden_answer(broken)
    _assert_valid_blocks_with_assumption(hardened)


def test_double_wrapped_answer_is_unwrapped() -> None:
    inner = json.dumps(
        [
            {"type": "markdown", "value": "Hay 11"},
            {
                "type": "assumption",
                "value": {"term": "entregas", "interpretation": "x", "predicate": "p"},
            },
        ],
        ensure_ascii=False,
    )
    wrapped = json.dumps([{"type": "markdown", "value": inner}], ensure_ascii=False)
    hardened = harden_answer(wrapped)
    _assert_valid_blocks_with_assumption(hardened)
    # The lone markdown-wrapping block is gone (unwrapped to the real blocks).
    blocks = json.loads(hardened)
    assert any(b.get("type") == "assumption" for b in blocks)


def test_prose_refusal_passes_through_unchanged() -> None:
    prose = "No pude planificar la consulta; reformúlala con más detalle."
    assert harden_answer(prose) == prose


def test_unsalvageable_block_answer_becomes_a_markdown_block() -> None:
    # Starts like a block answer but is hopeless — wrap as text, never raw dump.
    junk = "[ this is not json at all «»"
    hardened = harden_answer(junk)
    blocks = json.loads(hardened)  # still valid JSON
    assert isinstance(blocks, list)
    assert blocks[0]["type"] == "markdown"
