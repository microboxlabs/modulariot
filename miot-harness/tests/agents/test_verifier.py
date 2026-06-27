"""Completion verifier — rules + small LLM judge, with re-plan budget."""

from __future__ import annotations

import json
from typing import Any

import pytest
from langchain_core.language_models import FakeListChatModel

from miot_harness.agents.verifier import REPLAN, VERIFIED_DONE, verify_node
from miot_harness.config import HarnessSettings
from miot_harness.integrations.nexo.provider import NEXO_PROFILE
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.plan import DataEvidence


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="mintral", user_id="u")


def _ev(tool: str = "acs_query", *, is_sample: bool = False) -> DataEvidence:
    return DataEvidence(
        step_id="s1",
        tool=tool,
        source="acs",
        refreshed_at=None,
        output={"rows": [{"n": 25}]},
        sample_size=1,
        is_sample=is_sample,
        executed_sql="SELECT count(*) AS n FROM acs.act_ru_task",
    )


def _state(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "user_message": "¿cuántos servicios?",
        "ctx": _ctx(),
        "evidence": [],
        "turn_count": 0,
        "replan_count": 0,
    }
    base.update(overrides)
    return base


def _noop(_e: Any) -> None:
    return None


_SETTINGS = HarnessSettings(agents_agentic_max_replans=2, agents_agentic_max_turns=12)


@pytest.mark.asyncio
async def test_rules_only_no_evidence_replans() -> None:
    delta = await verify_node(
        _state(evidence=[]), model=None, settings=_SETTINGS, profile=NEXO_PROFILE,
        progress=_noop,
    )
    assert delta["next_action"] == REPLAN
    assert delta["replan_count"] == 1
    assert delta["verification_gap"]


@pytest.mark.asyncio
async def test_rules_only_with_evidence_is_done() -> None:
    delta = await verify_node(
        _state(evidence=[_ev()]), model=None, settings=_SETTINGS, profile=NEXO_PROFILE,
        progress=_noop,
    )
    assert delta["next_action"] == VERIFIED_DONE


@pytest.mark.asyncio
async def test_judge_gap_replans_with_gap_note() -> None:
    judge = FakeListChatModel(
        responses=[json.dumps({"fulfilled": False, "gap": "solo corrió un grep"})]
    )
    delta = await verify_node(
        _state(evidence=[_ev(is_sample=True)]),
        model=judge, settings=_SETTINGS, profile=NEXO_PROFILE, progress=_noop,
    )
    assert delta["next_action"] == REPLAN
    assert "grep" in delta["verification_gap"]


@pytest.mark.asyncio
async def test_judge_fulfilled_is_done() -> None:
    judge = FakeListChatModel(responses=[json.dumps({"fulfilled": True, "gap": ""})])
    delta = await verify_node(
        _state(evidence=[_ev()]),
        model=judge, settings=_SETTINGS, profile=NEXO_PROFILE, progress=_noop,
    )
    assert delta["next_action"] == VERIFIED_DONE


@pytest.mark.asyncio
async def test_replan_cap_forces_done_even_on_gap() -> None:
    judge = FakeListChatModel(
        responses=[json.dumps({"fulfilled": False, "gap": "still incomplete"})]
    )
    # replan_count already at the cap → accept and synthesize, never loop.
    delta = await verify_node(
        _state(evidence=[_ev()], replan_count=2),
        model=judge, settings=_SETTINGS, profile=NEXO_PROFILE, progress=_noop,
    )
    assert delta["next_action"] == VERIFIED_DONE


@pytest.mark.asyncio
async def test_malformed_judge_response_defaults_to_done() -> None:
    judge = FakeListChatModel(responses=["not json at all"])
    delta = await verify_node(
        _state(evidence=[_ev()]),
        model=judge, settings=_SETTINGS, profile=NEXO_PROFILE, progress=_noop,
    )
    assert delta["next_action"] == VERIFIED_DONE
