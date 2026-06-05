from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.router import IntentRouter
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.storytelling.module import StorytellingModule
from miot_harness.tools.registry import ToolRegistry, build_default_registry
from tests.fixtures.fake_provider import FAKE_PROFILE


def _supervisor(
    tmp_path, nexo_graph=None, *, registry: ToolRegistry | None = None
) -> HarnessSupervisor:
    return HarnessSupervisor(
        router=IntentRouter(),
        tools=registry if registry is not None else ToolRegistry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(tmp_path),
        nexo_graph=nexo_graph,
    )


@pytest.mark.asyncio
async def test_nexo_route_invokes_graph_when_present(tmp_path):
    """When the request matches a Nexo keyword, the supervisor must
    invoke the compiled nexo graph and surface the answer + events."""
    fake_event = HarnessEvent(run_id="r", type="answer.completed", message="done", data={})
    fake_graph = type("FakeGraph", (), {})()
    fake_graph.ainvoke = AsyncMock(
        return_value={
            "answer": "Operativo OK",
            "_events": [fake_event],
        }
    )
    sup = _supervisor(tmp_path, nexo_graph=fake_graph)

    record = await sup.run(UserRequest(message="estado coordinador?", tenant_id="mintral"))

    assert record.answer == "Operativo OK"
    assert any(e.type == "answer.completed" for e in record.events)
    # route.selected must include NEXO_QUERY
    selected = [e for e in record.events if e.type == "route.selected"]
    assert selected and "nexo_query" in str(selected[0].data.get("route", ""))


@pytest.mark.asyncio
async def test_nexo_route_handles_disabled_graph(tmp_path):
    """When Nexo is disabled (graph=None), the supervisor must produce
    a graceful refusal without raising."""
    sup = _supervisor(tmp_path, nexo_graph=None)
    record = await sup.run(UserRequest(message="coordinador status?", tenant_id="mintral"))
    assert record.status == "completed"
    assert record.answer
    assert "disabled" in record.answer.lower() or "unavailable" in record.answer.lower()


@pytest.mark.asyncio
async def test_storytelling_path_unchanged(tmp_path):
    """Existing storytelling flow must still work — no nexo keywords trigger
    the legacy path with the default tool registry."""
    sup = _supervisor(tmp_path, nexo_graph=None, registry=build_default_registry())
    record = await sup.run(UserRequest(message="write a story about delivery"))
    assert record.status == "completed"
    assert any(e.type == "artifact.created" for e in record.events)


@pytest.mark.asyncio
async def test_nexo_route_handles_graph_exception(tmp_path):
    """A graph crash must fail the run gracefully, not propagate."""
    fake_graph = type("FakeGraph", (), {})()
    fake_graph.ainvoke = AsyncMock(side_effect=RuntimeError("graph blew up"))
    sup = _supervisor(tmp_path, nexo_graph=fake_graph)

    record = await sup.run(UserRequest(message="coordinador?", tenant_id="mintral"))
    assert record.status == "failed"
    failed = [e for e in record.events if e.type == "run.failed"]
    assert failed


@pytest.mark.asyncio
async def test_disabled_message_uses_profile_display_name(tmp_path):
    """When profile is set on the supervisor, the disabled message uses
    profile.display_name instead of the legacy "Coordinador" literal."""
    sup = _supervisor(tmp_path, nexo_graph=None)
    sup.profile = FAKE_PROFILE

    record = await sup.run(UserRequest(message="coordinador status?", tenant_id="mintral"))
    assert record.status == "completed"
    assert record.answer is not None
    assert "FakeSource integration is currently disabled" in record.answer
