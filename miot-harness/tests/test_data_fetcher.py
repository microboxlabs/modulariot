from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from pydantic import BaseModel

from miot_harness.agents.data_fetcher import data_fetcher_node
from miot_harness.config import HarnessSettings
from miot_harness.integrations.nexo.provider import NEXO_PROFILE
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.plan import DataEvidence, DataPlan, DataStep
from miot_harness.runtime.tool import HarnessTool
from miot_harness.tools.registry import ToolRegistry


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="mintral", user_id="u")


def _stub_tool(name: str, output_payload: dict[str, Any]) -> HarnessTool:
    class _In(BaseModel):
        pass

    class _Out(BaseModel):
        rows: list[dict[str, Any]] = []
        refreshed_at: datetime | None = None
        source: str = "Coordinador · nexo (Citus DB)"

    async def _check(ctx, inp):
        return PermissionResult.allow()

    async def _call(ctx, inp, progress):
        return _Out(**output_payload)

    return HarnessTool(
        name=name,
        description="stub",
        input_model=_In,
        output_model=_Out,
        check_permission=_check,
        call=_call,
    )


@pytest.mark.asyncio
async def test_fetcher_invokes_pending_step_and_appends_evidence():
    """Reads the pending DataStep from state.plan, invokes via registry,
    appends evidence, advances pending_step_index, sets next_action."""
    refreshed = datetime(2026, 5, 8, 10, 0, tzinfo=UTC)
    registry = ToolRegistry()
    registry.register(
        _stub_tool(
            "coordinador_centro_control",
            {
                "rows": [{"n_eta_riesgo": 3, "refreshed_at_servicios": refreshed}],
                "refreshed_at": refreshed,
            },
        )
    )
    plan = DataPlan(
        steps=[
            DataStep(intent="initial", tool="coordinador_centro_control", args={}, rationale="r"),
        ]
    )
    state: dict[str, Any] = {
        "user_message": "?",
        "ctx": _ctx(),
        "plan": plan,
        "pending_step_index": 0,
        "evidence": [],
        "turn_count": 1,
    }
    events: list[HarnessEvent] = []

    update = await data_fetcher_node(
        state,
        registry=registry,
        settings=HarnessSettings(),
        progress=events.append,
        profile=NEXO_PROFILE,
    )

    assert update["pending_step_index"] == 1
    assert update["next_action"] == "judge_freshness"
    assert len(update["evidence"]) == 1
    ev = update["evidence"][0]
    assert isinstance(ev, DataEvidence)
    assert ev.tool == "coordinador_centro_control"
    assert ev.refreshed_at == refreshed
    assert "tool.completed" in {e.type for e in events}


@pytest.mark.asyncio
async def test_fetcher_records_failure_on_tool_error():
    """Tool raises → fetcher writes a failure entry but does NOT append
    evidence; supervisor will route to synthesizer."""

    class _In(BaseModel):
        pass

    class _Out(BaseModel):
        pass

    async def _check(ctx, inp):
        return PermissionResult.allow()

    async def _call(ctx, inp, progress):
        raise RuntimeError("connection lost")

    failing_tool = HarnessTool(
        name="coordinador_x",
        description="x",
        input_model=_In,
        output_model=_Out,
        check_permission=_check,
        call=_call,
    )
    registry = ToolRegistry()
    registry.register(failing_tool)

    plan = DataPlan(steps=[DataStep(intent="i", tool="coordinador_x", args={}, rationale="r")])
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "plan": plan,
        "pending_step_index": 0,
        "evidence": [],
        "turn_count": 1,
    }
    events: list[HarnessEvent] = []

    update = await data_fetcher_node(
        state,
        registry=registry,
        settings=HarnessSettings(),
        progress=events.append,
        profile=NEXO_PROFILE,
    )

    assert update.get("failure")
    assert "connection lost" in update["failure"]
    assert "tool.failed" in {e.type for e in events}


@pytest.mark.asyncio
async def test_fetcher_denied_permission_records_failure():
    """Tenant-locked tool denies → failure flag set."""

    class _In(BaseModel):
        pass

    class _Out(BaseModel):
        pass

    async def _check(ctx, inp):
        return PermissionResult.deny("Mintral-only")

    async def _call(ctx, inp, progress):
        return _Out()

    locked_tool = HarnessTool(
        name="coordinador_x",
        description="x",
        input_model=_In,
        output_model=_Out,
        check_permission=_check,
        call=_call,
    )
    registry = ToolRegistry()
    registry.register(locked_tool)

    plan = DataPlan(steps=[DataStep(intent="i", tool="coordinador_x", args={}, rationale="r")])
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "plan": plan,
        "pending_step_index": 0,
        "evidence": [],
        "turn_count": 1,
    }

    update = await data_fetcher_node(
        state,
        registry=registry,
        settings=HarnessSettings(),
        progress=lambda e: None,
        profile=NEXO_PROFILE,
    )
    assert update.get("failure")
    assert "Mintral" in update["failure"] or "permission" in update["failure"].lower()


@pytest.mark.asyncio
async def test_fetcher_unregistered_tool_emits_canonical_failure_schema():
    """When the planner picks a tool that isn't in the registry,
    registry.invoke() raises KeyError before HarnessTool.invoke runs.
    The fetcher emits tool.failed itself, and the payload must match
    the canonical schema (`tool`, `error`, `error_type`, `reason`) so
    SSE consumers don't have to special-case this branch. The returned
    state delta also surfaces `error` and `error_type` alongside
    `failure` so downstream synthesizer/critic nodes can read structured
    context, not just a stringified message.
    """

    plan = DataPlan(
        steps=[DataStep(intent="i", tool="not_a_real_tool", args={}, rationale="r")]
    )
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "plan": plan,
        "pending_step_index": 0,
        "evidence": [],
        "turn_count": 1,
    }
    events: list[HarnessEvent] = []

    update = await data_fetcher_node(
        state,
        registry=ToolRegistry(),
        settings=HarnessSettings(),
        progress=events.append,
        profile=NEXO_PROFILE,
    )

    # State delta carries the structured fields.
    assert update["error"] == "tool 'not_a_real_tool' is not registered"
    assert update["error_type"] == "KeyError"
    assert "not_a_real_tool" in update["failure"]

    # Emitted tool.failed event matches runtime/tool.py:_emit_failed schema.
    failed = [e for e in events if e.type == "tool.failed"]
    assert len(failed) == 1
    data = failed[0].data
    assert data["tool"] == "not_a_real_tool"
    assert data["error"] == "tool 'not_a_real_tool' is not registered"
    assert data["error_type"] == "KeyError"
    assert data["reason"] == data["error"]  # back-compat alias


@pytest.mark.asyncio
async def test_fetcher_no_pending_step_is_noop():
    """If pending_step_index >= len(steps), fetcher reports done without
    re-running anything."""
    plan = DataPlan(steps=[DataStep(intent="i", tool="coordinador_x", args={}, rationale="r")])
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "plan": plan,
        "pending_step_index": 1,  # already past
        "evidence": [],
        "turn_count": 2,
    }
    update = await data_fetcher_node(
        state,
        registry=ToolRegistry(),
        settings=HarnessSettings(),
        progress=lambda e: None,
        profile=NEXO_PROFILE,
    )
    assert update.get("next_action") == "ready_to_synthesize"


def _classify(payload: dict[str, Any]) -> DataEvidence:
    from miot_harness.agents.data_fetcher import _evidence_from_output

    return _evidence_from_output(
        "step_1",
        "coordinador_x",
        payload,
        warn_minutes=30,
        source_label=NEXO_PROFILE.source_label,
    )


def test_freshness_status_fresh_rows_and_fresh_timestamp() -> None:
    ev = _classify({"rows": [{"a": 1}], "refreshed_at": datetime.now(UTC)})
    assert ev.freshness_status == "fresh"
    assert ev.is_stale is False


def test_freshness_status_rows_with_old_timestamp() -> None:
    old = datetime(2026, 1, 1, tzinfo=UTC)
    ev = _classify({"rows": [{"a": 1}], "refreshed_at": old})
    assert ev.freshness_status == "stale"
    assert ev.is_stale is True


def test_freshness_status_rows_without_timestamp() -> None:
    ev = _classify({"rows": [{"a": 1}]})
    assert ev.freshness_status == "no_timestamp"
    assert ev.is_stale is True


def test_freshness_status_empty_with_fresh_timestamp_is_not_stale() -> None:
    """0 rows + a fresh snapshot timestamp means 'no rows matched the
    filter', NOT a stale snapshot — regression for the conflation bug."""
    ev = _classify({"rows": [], "refreshed_at": datetime.now(UTC)})
    assert ev.freshness_status == "empty"
    assert ev.is_stale is False


def test_freshness_status_empty_without_timestamp() -> None:
    """0 rows and no refreshed_at — likely an unrefreshed snapshot; the
    distinct status lets the synthesizer say so instead of guessing."""
    ev = _classify({"rows": []})
    assert ev.freshness_status == "empty_no_timestamp"
    assert ev.is_stale is True


def test_evidence_source_none_falls_back_to_profile_label() -> None:
    """A tool payload carrying source=None (or "") must fall back to the
    profile's source label instead of stringifying to the literal "None"."""
    from miot_harness.agents.data_fetcher import _evidence_from_output

    evidence = _evidence_from_output(
        "step_1",
        "fake_lookup",
        {"rows": [], "source": None},
        warn_minutes=30,
        source_label=NEXO_PROFILE.source_label,
    )
    assert evidence.source == NEXO_PROFILE.source_label

    evidence = _evidence_from_output(
        "step_1",
        "fake_lookup",
        {"rows": [], "source": ""},
        warn_minutes=30,
        source_label=NEXO_PROFILE.source_label,
    )
    assert evidence.source == NEXO_PROFILE.source_label
