from typing import Any

import pytest

from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.router import HarnessRoute, IntentRouter, RouteResult
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.storytelling.module import StorytellingModule
from miot_harness.tools.registry import ToolRegistry


class _AgenticRouter(IntentRouter):
    def route(self, message: str) -> RouteResult:
        return RouteResult(route=HarnessRoute.DATA_AGENTIC, reason="test")


class _FakeLoop:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def run(self, *, user_message, ctx, prior_messages, progress):
        self.calls.append({"user_message": user_message, "ctx": ctx})
        return {"answer": "loop answer", "evidence": [], "usage_log": []}


@pytest.mark.asyncio
async def test_agentic_route_prefers_agent_loop(tmp_path):
    loop = _FakeLoop()
    sup = HarnessSupervisor(
        router=_AgenticRouter(),
        tools=ToolRegistry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(tmp_path),
        agentic_graph=object(),  # would explode if invoked
        agent_loop=loop,
    )
    record = await sup.run(UserRequest(message="explore this", mode="agentic"))
    assert record.answer == "loop answer"
    assert record.status == "completed"
    assert loop.calls[0]["user_message"] == "explore this"


@pytest.mark.asyncio
async def test_agentic_route_falls_back_to_graph_when_no_loop(tmp_path):
    sup = HarnessSupervisor(
        router=_AgenticRouter(),
        tools=ToolRegistry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(tmp_path),
        agentic_graph=None,
        agent_loop=None,
    )
    record = await sup.run(UserRequest(message="explore this", mode="agentic"))
    assert "disabled" in (record.answer or "")
