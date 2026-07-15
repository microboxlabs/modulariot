"""The background distiller reflects interaction episodes into candidate facts.

Two things are pinned here: the deterministic OUTPUT SHAPE (parse_candidates is
model-free so the contract is testable without an LLM), and the safe degradation
(no model / no ungrounded terms → no candidates), plus that provenance is
grounded in the real episode run_ids rather than the model's word.
"""

from __future__ import annotations

from typing import Any

import pytest
from langchain_core.messages import AIMessage

from miot_harness.datasource.knowledge.distiller import (
    CandidateFact,
    distill_episodes,
    parse_candidates,
)


def _episode(
    run_id: str, term: str, *, grounded: bool = False, connection: str = "acs"
) -> dict[str, Any]:
    return {
        "run_id": run_id,
        "surface": "spotlight",
        "signal": "rephrase",
        "payload": {
            "query": f"cuantos servicios en {term}",
            "assumptions": [
                {
                    "term": term,
                    "interpretation": "confirmDelivery + receiveDelivery",
                    "predicate": "task_def_key in (...)",
                    "grounded": grounded,
                    "connection": connection,
                }
            ],
        },
    }


class _StubModel:
    """Minimal BaseChatModel stand-in: returns a canned answer for ainvoke."""

    def __init__(self, answer: str) -> None:
        self._answer = answer
        self.calls: list[Any] = []

    async def ainvoke(self, messages: Any, *args: Any, **kwargs: Any) -> AIMessage:
        self.calls.append(messages)
        return AIMessage(content=self._answer)


def test_parse_candidates_validates_shape() -> None:
    raw = [
        {"term": "entregas", "kind": "stage", "body": "def", "confidence": 0.8},
        {"term": "", "body": "no term"},  # dropped
        {"term": "sin cuerpo", "body": "   "},  # dropped
        "not a dict",  # dropped
    ]
    cands = parse_candidates(raw, connection="acs")
    assert [c.term for c in cands] == ["entregas"]
    c = cands[0]
    assert isinstance(c, CandidateFact)
    assert c.kind == "stage"
    assert c.connection == "acs"
    assert c.scope == "tenant"
    assert c.confidence == 0.8


def test_parse_candidates_defaults_unknown_kind_to_term() -> None:
    cands = parse_candidates(
        [{"term": "x", "body": "y", "kind": "bogus"}], connection="acs"
    )
    assert cands[0].kind == "term"


@pytest.mark.parametrize(
    ("value", "expected"),
    [(1.5, 1.0), (-0.2, 0.0), (0.5, 0.5), ("abc", None), (None, None), (True, None)],
)
def test_parse_candidates_clamps_confidence(value: Any, expected: float | None) -> None:
    cands = parse_candidates(
        [{"term": "x", "body": "y", "confidence": value}], connection="acs"
    )
    assert cands[0].confidence == expected


def test_parse_candidates_grounds_provenance_in_real_runs() -> None:
    episodes = [_episode("run_a", "entregas"), _episode("run_b", "entregas")]
    cands = parse_candidates(
        [{"term": "entregas", "body": "def"}], connection="acs", episodes=episodes
    )
    prov = cands[0].provenance
    assert prov["run_ids"] == ["run_a", "run_b"]
    assert prov["evidence"] == 2


def test_parse_candidates_rejects_non_array() -> None:
    assert parse_candidates({"term": "x"}, connection="acs") == []
    assert parse_candidates("nope", connection="acs") == []


@pytest.mark.asyncio
async def test_distill_without_model_returns_empty() -> None:
    episodes = [_episode("run_a", "entregas")]
    assert await distill_episodes(episodes, connection="acs", model=None) == []


@pytest.mark.asyncio
async def test_distill_without_ungrounded_terms_returns_empty() -> None:
    """A batch where every term is already grounded has nothing to learn — the
    model is never even called."""
    model = _StubModel("[]")
    episodes = [_episode("run_a", "entregas", grounded=True)]
    assert await distill_episodes(episodes, connection="acs", model=model) == []
    assert model.calls == []


@pytest.mark.asyncio
async def test_distill_emits_candidate_with_grounded_provenance() -> None:
    model = _StubModel(
        '[{"term": "entregas", "kind": "stage", '
        '"body": "task_def_key in (confirmDelivery)", "confidence": 0.9}]'
    )
    episodes = [_episode("run_a", "entregas"), _episode("run_b", "entregas")]
    cands = await distill_episodes(episodes, connection="acs", model=model)
    assert len(cands) == 1
    assert cands[0].term == "entregas"
    assert cands[0].kind == "stage"
    assert cands[0].confidence == 0.9
    assert cands[0].provenance == {"run_ids": ["run_a", "run_b"], "evidence": 2}


@pytest.mark.asyncio
async def test_distill_skips_already_defined_terms() -> None:
    model = _StubModel('[{"term": "entregas", "body": "x"}]')
    episodes = [_episode("run_a", "entregas")]
    cands = await distill_episodes(
        episodes, connection="acs", model=model, existing_terms=["Entregas"]
    )
    assert cands == []


@pytest.mark.asyncio
async def test_distill_swallows_bad_model_output() -> None:
    model = _StubModel("this is not json at all")
    episodes = [_episode("run_a", "entregas")]
    assert await distill_episodes(episodes, connection="acs", model=model) == []
