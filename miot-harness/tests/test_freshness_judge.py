from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from miot_harness.agents.freshness_judge import (
    FRESHNESS_FRESH,
    FRESHNESS_REFUSE,
    FRESHNESS_WARN,
    freshness_judge_node,
)
from miot_harness.config import HarnessSettings
from miot_harness.integrations.nexo.provider import NEXO_PROFILE
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.plan import DataEvidence


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="mintral", user_id="u")


def _ev(refreshed_at) -> DataEvidence:
    return DataEvidence(
        step_id="s",
        tool="coordinador_centro_control",
        source="src",
        refreshed_at=refreshed_at,
        output={},
        sample_size=1,
        is_stale=False,
    )


def test_fresh_evidence_passes_through():
    state: dict[str, Any] = {
        "ctx": _ctx(),
        "evidence": [_ev(datetime.now(UTC) - timedelta(minutes=5))],
        "turn_count": 1,
    }
    events: list[HarnessEvent] = []

    update = freshness_judge_node(
        state, settings=HarnessSettings(), progress=events.append, profile=NEXO_PROFILE
    )

    assert update["next_action"] == "analyze"
    assert "evidence" not in update  # judge does not mutate evidence (operator.add reducer)
    assert update.get("freshness") == FRESHNESS_FRESH
    assert "freshness.warning" not in {e.type for e in events}


def test_warn_zone_marks_is_stale_and_emits_warning_event():
    state = {
        "ctx": _ctx(),
        "evidence": [
            _ev(datetime.now(UTC) - timedelta(minutes=45))
        ],  # > warn (30) but < refuse (240)
        "turn_count": 1,
    }
    events: list[HarnessEvent] = []
    settings = HarnessSettings(
        datasource_freshness_warn_minutes=30, datasource_freshness_refuse_minutes=240
    )

    update = freshness_judge_node(
        state, settings=settings, progress=events.append, profile=NEXO_PROFILE
    )

    assert update["next_action"] == "analyze"
    assert "evidence" not in update  # judge does not mutate evidence
    assert update.get("freshness") == FRESHNESS_WARN
    assert "freshness.warning" in {e.type for e in events}


def test_refuse_zone_blocks_synthesizer():
    state = {
        "ctx": _ctx(),
        "evidence": [_ev(datetime.now(UTC) - timedelta(hours=72))],
        "turn_count": 1,
    }
    events: list[HarnessEvent] = []
    settings = HarnessSettings(datasource_freshness_refuse_minutes=240)

    update = freshness_judge_node(
        state, settings=settings, progress=events.append, profile=NEXO_PROFILE
    )

    assert update.get("freshness") == FRESHNESS_REFUSE
    assert update.get("failure")  # synth will render the refusal
    assert update["next_action"] == "ready_to_synthesize"
    assert "freshness.warning" in {e.type for e in events}


def test_settings_warn_override_beats_profile_default():
    """`datasource_freshness_warn_minutes` overrides the profile's 30.

    Evidence aged 10 min is FRESH under the profile default (30) but
    WARN once the env override tightens warn to 5 — proving the
    settings layer wins over the profile in the resolution.
    """
    state: dict[str, Any] = {
        "ctx": _ctx(),
        "evidence": [_ev(datetime.now(UTC) - timedelta(minutes=10))],
        "turn_count": 1,
    }

    # Profile default (warn=30): 10-min-old evidence is fresh.
    fresh_update = freshness_judge_node(
        state, settings=HarnessSettings(), progress=lambda e: None, profile=NEXO_PROFILE
    )
    assert fresh_update.get("freshness") == FRESHNESS_FRESH

    # Override warn=5: the same evidence is now in the warn zone.
    events: list[HarnessEvent] = []
    warn_update = freshness_judge_node(
        state,
        settings=HarnessSettings(datasource_freshness_warn_minutes=5),
        progress=events.append,
        profile=NEXO_PROFILE,
    )
    assert warn_update.get("freshness") == FRESHNESS_WARN
    assert "freshness.warning" in {e.type for e in events}


def test_no_refreshed_at_treated_as_warn_not_refuse():
    """Evidence without refreshed_at is unverified; warn but don't block."""
    state = {
        "ctx": _ctx(),
        "evidence": [_ev(None)],
        "turn_count": 1,
    }
    update = freshness_judge_node(
        state, settings=HarnessSettings(), progress=lambda e: None, profile=NEXO_PROFILE
    )
    assert update.get("freshness") == FRESHNESS_WARN
    assert update["next_action"] == "analyze"


def test_empty_no_timestamp_warns_with_reason_but_never_refuses():
    """0 rows + no refreshed_at = probably an unrefreshed snapshot. The
    judge must warn (with a machine-readable reason) but NOT refuse —
    refusal is reserved for provably old timestamps."""
    ev = DataEvidence(
        step_id="s",
        tool="coordinador_task_timeline",
        source="src",
        refreshed_at=None,
        output={"rows": []},
        sample_size=0,
        is_stale=True,
        freshness_status="empty_no_timestamp",
    )
    state: dict[str, Any] = {"ctx": _ctx(), "evidence": [ev], "turn_count": 1}
    events: list[HarnessEvent] = []

    update = freshness_judge_node(
        state, settings=HarnessSettings(), progress=events.append, profile=NEXO_PROFILE
    )

    assert update.get("freshness") == FRESHNESS_WARN
    assert "failure" not in update
    warnings = [e for e in events if e.type == "freshness.warning"]
    assert len(warnings) == 1
    assert warnings[0].data.get("reason") == "empty_no_timestamp"
