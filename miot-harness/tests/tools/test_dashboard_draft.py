"""The `dashboard_draft` tool: names widgets of the thread for the app to save."""

from __future__ import annotations

import pytest

from miot_harness.agents.native_tools import build_native_tools
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import PermissionDecision
from miot_harness.tools.dashboard_draft import MAX_DASHBOARD_WIDGETS, dashboard_draft_tool
from miot_harness.tools.registry import build_default_registry
from tests.fixtures.fake_provider import FAKE_PROFILE

KPI = "w0123456789"
CHART = "wabcdef0123"


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="acme", user_id="u1", run_id="r1")


async def _invoke(raw: dict[str, object]) -> tuple[object, list[HarnessEvent]]:
    events: list[HarnessEvent] = []
    output = await dashboard_draft_tool().invoke(_ctx(), raw, events.append)
    return output, events


@pytest.mark.asyncio
async def test_a_draft_is_sent_to_the_app_with_its_widgets_in_order() -> None:
    output, events = await _invoke(
        {"title": "Trips", "description": "Trips per day", "widgets": [KPI, CHART, KPI]}
    )

    drafts = [e for e in events if e.type == "dashboard.draft"]
    assert len(drafts) == 1
    assert drafts[0].data == {
        "id": output.id,  # type: ignore[attr-defined]
        "title": "Trips",
        "description": "Trips per day",
        "widgets": [KPI, CHART],
    }


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "widgets",
    [[], ["trips_by_day"], [f"w{i:010x}" for i in range(MAX_DASHBOARD_WIDGETS + 1)]],
)
async def test_widgets_that_are_not_show_results_are_refused(widgets: list[str]) -> None:
    with pytest.raises(ValueError):
        await _invoke({"title": "T", "widgets": widgets})


@pytest.mark.asyncio
async def test_it_runs_without_asking_because_nothing_is_saved() -> None:
    tool = dashboard_draft_tool()
    assert tool.check_permission is not None
    result = await tool.check_permission(_ctx(), tool.input_model(title="T", widgets=[KPI]))
    assert result.decision == PermissionDecision.ALLOW


def test_the_loop_is_offered_the_tool() -> None:
    names = {t["name"] for t in build_native_tools(build_default_registry(), profile=FAKE_PROFILE)}
    assert "dashboard_draft" in names
