"""Graceful shutdown: SIGTERM drains in-flight runs, then interrupts the rest."""

from __future__ import annotations

import asyncio
import signal
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from miot_harness.api.drain import RunDrain, install_sigterm_drain
from miot_harness.api.server import create_app
from miot_harness.config import get_settings
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.tools.registry import ToolRegistry


class _GatedLoop:
    def __init__(self) -> None:
        self.release = asyncio.Event()

    async def run(self, *, user_message, ctx, prior_messages, progress) -> dict[str, Any]:
        await self.release.wait()
        return {"answer": "ok", "messages": [AIMessage(content="ok")]}


def _start(tmp_path: Any, loop: _GatedLoop, run_id: str) -> tuple[HarnessSupervisor, asyncio.Task]:
    harness = HarnessSupervisor(
        tools=ToolRegistry(), run_store=JsonRunStore(tmp_path), agent_loop=loop
    )
    task = asyncio.create_task(
        harness.run(UserRequest(message="q", tenant_id="orion"), run_id_override=run_id)
    )
    return harness, task


@pytest.mark.asyncio
async def test_drain_waits_for_a_run_that_finishes_in_time(tmp_path: Any) -> None:
    loop = _GatedLoop()
    harness, task = _start(tmp_path, loop, "run_quick")
    drain = RunDrain({"run_quick": task}, timeout_seconds=5)

    draining = asyncio.create_task(drain.drain())
    await asyncio.sleep(0.05)
    assert drain.draining
    assert not draining.done()
    loop.release.set()
    await asyncio.wait_for(draining, timeout=5)

    assert harness.run_store.load("run_quick").status == "completed"


@pytest.mark.asyncio
async def test_drain_interrupts_runs_past_the_timeout(tmp_path: Any) -> None:
    harness, task = _start(tmp_path, _GatedLoop(), "run_slow")
    await asyncio.sleep(0)

    await asyncio.wait_for(RunDrain({"run_slow": task}, timeout_seconds=0.05).drain(), timeout=5)

    assert task.cancelled()
    record = harness.run_store.load("run_slow")
    assert record.status == "failed"
    [failed] = [e for e in record.events if e.type == "run.failed"]
    assert failed.data["reason"] == "interrupted"


@pytest.mark.asyncio
async def test_sigterm_drains_before_passing_the_signal_on(tmp_path: Any) -> None:
    loop = _GatedLoop()
    harness, task = _start(tmp_path, loop, "run_sig")
    drain = RunDrain({"run_sig": task}, timeout_seconds=5)
    passed_on = asyncio.Event()
    event_loop = asyncio.get_running_loop()

    def server_handler(_signum: int, _frame: Any) -> None:
        event_loop.call_soon_threadsafe(passed_on.set)

    original = signal.signal(signal.SIGTERM, server_handler)
    try:
        restore = install_sigterm_drain(drain, event_loop)
        assert restore is not None
        signal.raise_signal(signal.SIGTERM)
        await asyncio.sleep(0.05)
        assert drain.draining
        assert not passed_on.is_set()

        loop.release.set()
        await asyncio.wait_for(passed_on.wait(), timeout=5)
        assert harness.run_store.load("run_sig").status == "completed"
        assert signal.getsignal(signal.SIGTERM) is server_handler
    finally:
        signal.signal(signal.SIGTERM, original)


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_DSN", raising=False)
    get_settings.cache_clear()
    with TestClient(create_app()) as c:
        yield c
    get_settings.cache_clear()


def test_draining_refuses_new_runs_and_fails_readiness(client: TestClient) -> None:
    app: Any = client.app
    assert client.get("/health/ready").status_code == 200
    app.state.drain.draining = True

    resp = client.post("/runs:start", json={"message": "q", "tenant_id": "orion"})
    assert resp.status_code == 503
    assert resp.headers["Retry-After"] == "10"
    assert client.post("/runs", json={"message": "q", "tenant_id": "orion"}).status_code == 503

    ready = client.get("/health/ready")
    assert ready.status_code == 503
    assert ready.json()["status"] == "draining"
    assert client.get("/health").status_code == 200
