"""Supervisor <-> SteeringRegistry wiring (Plan C, Task 3).

The factory builds a supervisor with an always-on `SteeringRegistry`. The
supervisor must `open()` the per-run channel at run start, plumb the handle
into the `HarnessContext`, and ALWAYS `close()` it when the run ends — on
the happy path, on dispatch failure, and on cancellation. After close, the
run's channel is gone, so `push()` returns False and `is_interrupted()`
returns False.

CLI/eval paths construct the supervisor without a steering_registry, so it
stays None and behaves exactly as before (no open/close, no plumbing).
"""

from __future__ import annotations

import asyncio
import json
import tempfile
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

import pytest
from langchain_core.language_models import FakeListChatModel

from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.factory import build_harness
from miot_harness.runtime.intent_router import LLMIntentRouter
from miot_harness.runtime.router import IntentRouter
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.steering import SteeringRegistry
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.storytelling.module import StorytellingModule
from miot_harness.tools.registry import ToolRegistry


def _scripted_router(route: str) -> LLMIntentRouter:
    model = FakeListChatModel(
        responses=[json.dumps({"route": route, "confidence": 0.95})]
    )
    return LLMIntentRouter(
        model, confidence_threshold=0.7, keyword_fallback=IntentRouter()
    )


class _SpySteeringRegistry(SteeringRegistry):
    """Records open/close calls so we can assert close fires once per run on
    every exit path, while keeping the real channel semantics."""

    def __init__(self) -> None:
        super().__init__()
        self.opened: list[str] = []
        self.closed: list[str] = []

    def open(self, run_id: str) -> None:
        self.opened.append(run_id)
        super().open(run_id)

    def close(self, run_id: str) -> None:
        self.closed.append(run_id)
        super().close(run_id)


def _supervisor(
    tmp_path: Any,
    *,
    data_graph: Any = None,
    steering_registry: SteeringRegistry | None = None,
) -> HarnessSupervisor:
    return HarnessSupervisor(
        router=IntentRouter(),
        tools=ToolRegistry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(tmp_path),
        data_graph=data_graph,
        llm_router=_scripted_router("DATA_QUERY"),
        tenant_lock="mintral",
        steering_registry=steering_registry,
    )


def test_factory_builds_supervisor_with_steering_registry() -> None:
    sup = build_harness(Path(tempfile.mkdtemp()))
    assert isinstance(sup.steering_registry, SteeringRegistry)


@pytest.mark.asyncio
async def test_channel_closed_after_normal_run(tmp_path: Any) -> None:
    data_graph = AsyncMock()
    data_graph.ainvoke = AsyncMock(return_value={"answer": "ok", "_events": []})
    reg = SteeringRegistry()
    sup = _supervisor(tmp_path, data_graph=data_graph, steering_registry=reg)

    record = await sup.run(UserRequest(message="q", tenant_id="mintral"))

    assert record.status == "completed"
    # Channel is gone: push fails, interrupt flag absent.
    assert reg.push(record.run_id, "x") is False
    assert reg.is_interrupted(record.run_id) is False


@pytest.mark.asyncio
async def test_channel_opened_and_plumbed_during_run(tmp_path: Any) -> None:
    """While the run is in flight, the channel is open (push succeeds) and
    the handle is plumbed into the ctx the graph receives."""

    reg = SteeringRegistry()
    seen_ctx: dict[str, Any] = {}

    async def _ainvoke(state: dict[str, Any]) -> dict[str, Any]:
        ctx = state["ctx"]
        seen_ctx["registry"] = ctx.steering_registry
        # Channel is open mid-run: a push lands.
        seen_ctx["push_ok"] = reg.push(ctx.run_id, "note")
        return {"answer": "ok", "_events": []}

    data_graph = AsyncMock()
    data_graph.ainvoke = _ainvoke
    sup = _supervisor(tmp_path, data_graph=data_graph, steering_registry=reg)

    await sup.run(UserRequest(message="q", tenant_id="mintral"))

    assert seen_ctx["registry"] is reg
    assert seen_ctx["push_ok"] is True


@pytest.mark.asyncio
async def test_channel_closed_once_on_success(tmp_path: Any) -> None:
    data_graph = AsyncMock()
    data_graph.ainvoke = AsyncMock(return_value={"answer": "ok", "_events": []})
    reg = _SpySteeringRegistry()
    sup = _supervisor(tmp_path, data_graph=data_graph, steering_registry=reg)

    record = await sup.run(UserRequest(message="q", tenant_id="mintral"))

    assert reg.opened == [record.run_id]
    assert reg.closed == [record.run_id]


@pytest.mark.asyncio
async def test_channel_closed_on_run_failure(tmp_path: Any) -> None:
    data_graph = AsyncMock()
    data_graph.ainvoke = AsyncMock(side_effect=RuntimeError("boom"))
    reg = _SpySteeringRegistry()
    sup = _supervisor(tmp_path, data_graph=data_graph, steering_registry=reg)

    record = await sup.run(UserRequest(message="q", tenant_id="mintral"))

    assert record.status == "failed"
    assert reg.closed == [record.run_id]
    # Channel really is gone.
    assert reg.push(record.run_id, "x") is False


@pytest.mark.asyncio
async def test_channel_closed_on_cancellation(tmp_path: Any) -> None:
    data_graph = AsyncMock()
    data_graph.ainvoke = AsyncMock(side_effect=asyncio.CancelledError())
    reg = _SpySteeringRegistry()
    sup = _supervisor(tmp_path, data_graph=data_graph, steering_registry=reg)

    with pytest.raises(asyncio.CancelledError):
        await sup.run(
            UserRequest(message="q", tenant_id="mintral"),
            run_id_override="run_steer_cancel",
        )

    assert reg.opened == ["run_steer_cancel"]
    assert reg.closed == ["run_steer_cancel"]
    assert reg.push("run_steer_cancel", "x") is False


@pytest.mark.asyncio
async def test_no_registry_leaves_ctx_unplumbed(tmp_path: Any) -> None:
    """Eval / CLI path: no steering_registry -> ctx handle stays None and
    behavior is unchanged."""

    seen: dict[str, Any] = {}

    async def _ainvoke(state: dict[str, Any]) -> dict[str, Any]:
        seen["registry"] = state["ctx"].steering_registry
        return {"answer": "ok", "_events": []}

    data_graph = AsyncMock()
    data_graph.ainvoke = _ainvoke
    sup = _supervisor(tmp_path, data_graph=data_graph, steering_registry=None)

    record = await sup.run(UserRequest(message="q", tenant_id="mintral"))

    assert record.status == "completed"
    assert seen["registry"] is None
