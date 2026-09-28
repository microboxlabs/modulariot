from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from pydantic import BaseModel

from miot_harness.config import HarnessSettings
from miot_harness.integrations.nexo.provider import NEXO_PROFILE
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.evidence import DataEvidence, DataStep
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool
from miot_harness.runtime.tool_step import invoke_step
from miot_harness.tools.registry import ToolRegistry


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="orion", user_id="u")


class _In(BaseModel):
    pass


def _tool(name: str, *, call: Any, check: Any = None) -> HarnessTool:
    class _Out(BaseModel):
        rows: list[dict[str, Any]] = []
        refreshed_at: datetime | None = None
        source: str = "Coordinador · nexo (Citus DB)"

    async def _allow(ctx: Any, inp: Any) -> PermissionResult:
        return PermissionResult.allow()

    async def _call(ctx: Any, inp: Any, progress: Any) -> Any:
        return _Out(**(await call()))

    return HarnessTool(
        name=name,
        description="stub",
        input_model=_In,
        output_model=_Out,
        check_permission=check or _allow,
        call=_call,
    )


async def _run(registry: ToolRegistry, tool: str) -> tuple[dict[str, Any], list[HarnessEvent]]:
    events: list[HarnessEvent] = []
    delta = await invoke_step(
        DataStep(intent="i", tool=tool, args={}, rationale="r"),
        ctx=_ctx(),
        registry=registry,
        settings=HarnessSettings(),
        progress=events.append,
        profile=NEXO_PROFILE,
    )
    return delta, events


@pytest.mark.asyncio
async def test_a_tool_call_becomes_evidence() -> None:
    refreshed = datetime(2026, 5, 8, 10, 0, tzinfo=UTC)

    async def call() -> dict[str, Any]:
        return {
            "rows": [{"n_eta_riesgo": 3, "refreshed_at_servicios": refreshed}],
            "refreshed_at": refreshed,
        }

    registry = ToolRegistry()
    registry.register(_tool("coordinador_centro_control", call=call))

    delta, events = await _run(registry, "coordinador_centro_control")

    [ev] = delta["evidence"]
    assert isinstance(ev, DataEvidence)
    assert ev.tool == "coordinador_centro_control"
    assert ev.refreshed_at == refreshed
    assert "tool.completed" in {e.type for e in events}


@pytest.mark.asyncio
async def test_a_tool_error_is_a_failure_not_an_exception() -> None:
    async def call() -> dict[str, Any]:
        raise RuntimeError("connection lost")

    registry = ToolRegistry()
    registry.register(_tool("coordinador_x", call=call))

    delta, events = await _run(registry, "coordinador_x")

    assert "connection lost" in delta["failure"]
    assert "evidence" not in delta
    assert "tool.failed" in {e.type for e in events}


@pytest.mark.asyncio
async def test_a_denied_permission_is_a_failure() -> None:
    async def call() -> dict[str, Any]:
        return {}

    async def deny(ctx: Any, inp: Any) -> PermissionResult:
        return PermissionResult.deny("Orion-only")

    registry = ToolRegistry()
    registry.register(_tool("coordinador_x", call=call, check=deny))

    delta, _ = await _run(registry, "coordinador_x")

    assert "Orion-only" in delta["failure"]


@pytest.mark.asyncio
async def test_an_unregistered_tool_fails_with_the_canonical_event() -> None:
    delta, events = await _run(ToolRegistry(), "not_a_real_tool")

    assert delta["error"] == "tool 'not_a_real_tool' is not registered"
    assert delta["error_type"] == "KeyError"
    assert "not_a_real_tool" in delta["failure"]
    [failed] = [e for e in events if e.type == "tool.failed"]
    assert failed.data == {
        "tool": "not_a_real_tool",
        "error": "tool 'not_a_real_tool' is not registered",
        "error_type": "KeyError",
        "reason": "tool 'not_a_real_tool' is not registered",
    }


def _classify(
    payload: dict[str, Any], *, has_freshness_model: bool = True
) -> DataEvidence:
    from miot_harness.runtime.tool_step import _evidence_from_output

    return _evidence_from_output(
        "step_1",
        "coordinador_x",
        payload,
        warn_minutes=30,
        source_label=NEXO_PROFILE.source_label,
        has_freshness_model=has_freshness_model,
    )


def test_live_source_no_timestamp_is_fresh_not_stale() -> None:
    # A live datasource (has_freshness_model=False) with no refreshed_at must
    # NOT be flagged no_timestamp/stale — that drove the misleading
    # "trust with caution" note on a live operational schema.
    ev = _classify({"rows": [{"a": 1}]}, has_freshness_model=False)
    assert ev.freshness_status == "fresh"
    assert ev.is_stale is False


def test_live_source_empty_is_empty_not_no_timestamp() -> None:
    ev = _classify({"rows": []}, has_freshness_model=False)
    assert ev.freshness_status == "empty"
    assert ev.is_stale is False


def test_evidence_threads_executed_sql_from_output() -> None:
    # Generic safe-query tools surface output.executed_sql; it must land on the
    # evidence so the synthesizer can cite what actually ran.
    ev = _classify(
        {"rows": [{"a": 1}], "executed_sql": "SELECT a FROM acs.t LIMIT 100"},
        has_freshness_model=False,
    )
    assert ev.executed_sql == "SELECT a FROM acs.t LIMIT 100"


def test_evidence_executed_sql_absent_is_none() -> None:
    ev = _classify({"rows": [{"a": 1}]}, has_freshness_model=False)
    assert ev.executed_sql is None


def test_evidence_grep_tool_is_marked_sample() -> None:
    from miot_harness.runtime.tool_step import _evidence_from_output

    grep_ev = _evidence_from_output(
        "s1", "acs_grep", {"rows": [{"a": 1}]},
        warn_minutes=30, source_label="acs", has_freshness_model=False,
    )
    query_ev = _evidence_from_output(
        "s2", "acs_query", {"rows": [{"a": 1}]},
        warn_minutes=30, source_label="acs", has_freshness_model=False,
    )
    assert grep_ev.is_sample is True  # fuzzy ILIKE sample — never a total
    assert query_ev.is_sample is False


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
    from miot_harness.runtime.tool_step import _evidence_from_output

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


def test_evidence_freshness_uses_freshest_row_across_layers() -> None:
    """Multi-layer outputs (centro_control: one row per capa) must not be
    flagged stale just because row 0 happens to be the stale layer."""
    now = datetime.now(UTC)
    stale = now - timedelta(days=33)
    ev = _classify(
        {
            "rows": [
                {"capa": "torre", "refreshed_at_torre": stale},
                {"capa": "servicios", "refreshed_at_servicios": now},
            ]
        }
    )
    assert ev.freshness_status == "fresh"
    assert ev.is_stale is False
    assert ev.refreshed_at == now


def test_evidence_handles_naive_datetimes_without_crashing() -> None:
    """pg `timestamp` (no tz) columns arrive as naive datetimes; mixing
    them with aware ones must not raise TypeError in max()/subtraction —
    naive values are coerced to UTC."""
    now_aware = datetime.now(UTC)
    naive_old = datetime(2026, 1, 1, 12, 0)  # no tzinfo
    ev = _classify(
        {
            "rows": [
                {"capa": "a", "refreshed_at_x": naive_old},
                {"capa": "b", "refreshed_at_y": now_aware},
            ]
        }
    )
    assert ev.freshness_status == "fresh"
    assert ev.refreshed_at == now_aware

    # All-naive also works (coerced to UTC, then age math succeeds).
    ev = _classify({"rows": [{"refreshed_at_x": datetime(2026, 1, 1, 12, 0)}]})
    assert ev.freshness_status == "stale"
    assert ev.refreshed_at is not None and ev.refreshed_at.tzinfo is not None
