from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime, timedelta

from miot_harness.config import HarnessSettings
from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.integrations.nexo.provider import NEXO_PROFILE
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.evidence import DataEvidence
from miot_harness.runtime.freshness import (
    FRESHNESS_FRESH,
    FRESHNESS_REFUSE,
    FRESHNESS_WARN,
    judge_freshness,
)


def _ev(refreshed_at: datetime | None, **extra: object) -> DataEvidence:
    fields: dict[str, object] = {
        "step_id": "s",
        "tool": "coordinador_centro_control",
        "source": "src",
        "refreshed_at": refreshed_at,
        "output": {},
        "sample_size": 1,
    }
    fields.update(extra)
    return DataEvidence.model_validate(fields)


def _judge(
    evidence: list[DataEvidence],
    settings: HarnessSettings | None = None,
    profile: DataSourceProfile = NEXO_PROFILE,
) -> tuple[str, list[HarnessEvent]]:
    events: list[HarnessEvent] = []
    verdict = judge_freshness(
        evidence,
        ctx=HarnessContext(thread_id="t", tenant_id="orion", user_id="u"),
        settings=settings or HarnessSettings(),
        progress=events.append,
        profile=profile,
    )
    return verdict, events


def _warnings(events: list[HarnessEvent]) -> list[HarnessEvent]:
    return [e for e in events if e.type == "freshness.warning"]


def test_fresh_evidence_emits_nothing() -> None:
    verdict, events = _judge([_ev(datetime.now(UTC) - timedelta(minutes=5))])

    assert verdict == FRESHNESS_FRESH
    assert _warnings(events) == []


def test_warn_zone_emits_a_warning() -> None:
    settings = HarnessSettings(
        datasource_freshness_warn_minutes=30, datasource_freshness_refuse_minutes=240
    )

    verdict, events = _judge([_ev(datetime.now(UTC) - timedelta(minutes=45))], settings)

    assert verdict == FRESHNESS_WARN
    assert len(_warnings(events)) == 1


def test_refuse_zone_is_reported() -> None:
    settings = HarnessSettings(datasource_freshness_refuse_minutes=240)

    verdict, events = _judge([_ev(datetime.now(UTC) - timedelta(hours=72))], settings)

    assert verdict == FRESHNESS_REFUSE
    assert len(_warnings(events)) == 1


def test_the_env_override_beats_the_profile_default() -> None:
    evidence = [_ev(datetime.now(UTC) - timedelta(minutes=10))]

    assert _judge(evidence)[0] == FRESHNESS_FRESH
    assert _judge(evidence, HarnessSettings(datasource_freshness_warn_minutes=5))[0] == (
        FRESHNESS_WARN
    )


def test_missing_timestamp_warns_and_never_refuses() -> None:
    assert _judge([_ev(None)])[0] == FRESHNESS_WARN


def test_empty_snapshot_without_timestamp_says_why() -> None:
    evidence = _ev(
        None,
        tool="coordinador_task_timeline",
        output={"rows": []},
        sample_size=0,
        is_stale=True,
        freshness_status="empty_no_timestamp",
    )

    verdict, events = _judge([evidence])

    assert verdict == FRESHNESS_WARN
    assert [w.data.get("reason") for w in _warnings(events)] == ["empty_no_timestamp"]


def test_a_live_datasource_is_never_stale() -> None:
    live = replace(NEXO_PROFILE, has_freshness_model=False)

    verdict, events = _judge([_ev(None)], profile=live)

    assert verdict == FRESHNESS_FRESH
    assert _warnings(events) == []


def test_no_evidence_is_fresh() -> None:
    assert _judge([]) == (FRESHNESS_FRESH, [])
