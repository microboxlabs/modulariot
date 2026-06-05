from __future__ import annotations

from typing import Any

from miot_harness.agents.supervisor import next_agent
from miot_harness.config import HarnessSettings
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.plan import DataEvidence, DataPlan, DataStep


def _settings(**overrides: Any) -> HarnessSettings:
    return HarnessSettings(**overrides)


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="mintral", user_id="u")


def test_no_plan_routes_to_filter_expert():
    state = {"user_message": "what?", "ctx": _ctx(), "evidence": [], "turn_count": 0}
    assert next_agent(state, _settings()) == "filter_expert"


def test_pending_step_routes_to_data_fetcher():
    plan = DataPlan(steps=[DataStep(intent="i", tool="t", args={}, rationale="r")])
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "plan": plan,
        "pending_step_index": 0,
        "evidence": [],
        "turn_count": 0,
    }
    assert next_agent(state, _settings()) == "data_fetcher"


def test_fresh_evidence_routes_to_freshness_judge():
    """After data_fetcher emits evidence, supervisor routes through
    freshness_judge before the analyst sees it."""
    plan = DataPlan(steps=[DataStep(intent="i", tool="t", args={}, rationale="r")])
    ev = DataEvidence(
        step_id="s1",
        tool="t",
        source="src",
        refreshed_at=None,
        output={},
        sample_size=0,
        is_stale=False,
    )
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "plan": plan,
        "pending_step_index": 1,  # consumed
        "evidence": [ev],
        "turn_count": 1,
        "next_action": "judge_freshness",
    }
    assert next_agent(state, _settings()) == "freshness_judge"


def test_analyst_requests_more_data_loops_back_to_filter_expert():
    plan = DataPlan(steps=[DataStep(intent="i", tool="t", args={}, rationale="r")])
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "plan": plan,
        "pending_step_index": 1,
        "evidence": [
            DataEvidence(
                step_id="s",
                tool="t",
                source="x",
                refreshed_at=None,
                output={},
                sample_size=0,
                is_stale=False,
            )
        ],
        "turn_count": 2,
        "next_action": "need_more_tools",
    }
    assert next_agent(state, _settings()) == "filter_expert"


def test_analyst_ready_routes_to_synthesizer():
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "evidence": [
            DataEvidence(
                step_id="s",
                tool="t",
                source="x",
                refreshed_at=None,
                output={},
                sample_size=0,
                is_stale=False,
            )
        ],
        "turn_count": 3,
        "next_action": "ready_to_synthesize",
    }
    assert next_agent(state, _settings()) == "synthesizer"


def test_failure_routes_to_synthesizer():
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "evidence": [],
        "turn_count": 1,
        "failure": "stale_snapshot",
    }
    assert next_agent(state, _settings()) == "synthesizer"


def test_answer_set_routes_to_end():
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "evidence": [],
        "turn_count": 4,
        "answer": "Operativo OK al 10:00 UTC.",
    }
    assert next_agent(state, _settings()) == "__end__"


def test_turn_cap_forces_synthesizer():
    """Defense against runaway loops — at the cap, force the synthesizer."""
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "evidence": [
            DataEvidence(
                step_id="s",
                tool="t",
                source="x",
                refreshed_at=None,
                output={},
                sample_size=0,
                is_stale=False,
            )
        ],
        "turn_count": 8,
        "next_action": "need_more_tools",
    }
    assert next_agent(state, _settings(nexo_max_turns=8)) == "synthesizer"


def test_summarizer_triggered_when_messages_exceed_threshold():
    """Auto-summarize at >10 transcript messages to keep context bounded."""
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "evidence": [],
        "turn_count": 3,
        "messages": [{"role": "user", "content": "x"}] * 11,  # > 10
    }
    assert next_agent(state, _settings()) == "summarizer"


def test_default_after_freshness_judge_routes_to_analyst():
    plan = DataPlan(steps=[DataStep(intent="i", tool="t", args={}, rationale="r")])
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "plan": plan,
        "pending_step_index": 1,
        "evidence": [
            DataEvidence(
                step_id="s",
                tool="t",
                source="x",
                refreshed_at=None,
                output={},
                sample_size=0,
                is_stale=False,
            )
        ],
        "turn_count": 2,
        "next_action": "analyze",
    }
    assert next_agent(state, _settings()) == "domain_analyst"
