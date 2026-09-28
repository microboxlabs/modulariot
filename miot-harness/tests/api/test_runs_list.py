"""GET /runs: the caller's running and recent runs, as summaries."""

from __future__ import annotations

import asyncio
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from miot_harness.api.server import _list_runs, create_app
from miot_harness.config import get_settings
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.run_store import HarnessRunRecord, JsonRunStore, summarize
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.tools.registry import ToolRegistry

TENANT = "X-Miot-Tenant-Client-Id"
USER = "X-Miot-User-Email"
T0 = datetime(2026, 1, 1, tzinfo=UTC)


@pytest.fixture(autouse=True)
def _clean_settings_and_workspace(tmp_path: Any, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_DSN", raising=False)
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_KIND", raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _event(run_id: str, type_: str, seconds: int, **data: Any) -> HarnessEvent:
    return HarnessEvent(
        run_id=run_id,
        type=type_,  # type: ignore[arg-type]
        message=data.pop("message", type_),
        data=data,
        created_at=T0 + timedelta(seconds=seconds),
    )


def _record(
    run_id: str,
    *,
    tenant: str = "acme",
    user: str = "ana@example.com",
    conversation: str = "c1",
    status: str = "completed",
) -> HarnessRunRecord:
    return HarnessRunRecord(
        run_id=run_id,
        status=status,
        tenant_id=tenant,
        user_id=user,
        conversation_id=conversation,
        model="model-a",
        skill_id="analyst",
        events=[
            _event(run_id, "run.started", 0),
            _event(run_id, "tool.started", 2, tool="db_query", message="Starting db_query"),
            _event(run_id, "usage.recorded", 3, input_tokens=100, output_tokens=20),
            _event(run_id, "usage.recorded", 4, input_tokens=50, output_tokens=5),
            _event(run_id, "run.completed", 9),
        ],
    )


def test_summary_carries_step_usage_and_times() -> None:
    summary = summarize(_record("run_1"))
    assert summary.status == "completed"
    assert summary.started_at == T0
    assert summary.finished_at == T0 + timedelta(seconds=9)
    assert summary.last_step is not None
    assert summary.last_step.tool == "db_query"
    assert summary.last_step.label == "Starting db_query"
    assert (summary.usage.calls, summary.usage.input_tokens, summary.usage.output_tokens) == (
        2,
        150,
        25,
    )
    assert (summary.model, summary.skill_id) == ("model-a", "analyst")


def test_summary_lists_delegates() -> None:
    record = HarnessRunRecord(
        run_id="run_d",
        status="running",
        events=[
            _event("run_d", "agent.started", 0, agent="workhorse", brief="count trips"),
            _event("run_d", "agent.started", 1, agent="workhorse", brief="list drivers"),
            _event("run_d", "agent.started", 2, agent="workhorse", turn=1),
            # Concurrent delegates: the second one finishes first.
            _event("run_d", "delegate.completed", 3, brief="list drivers"),
        ],
    )
    summary = summarize(record)
    assert [(d.brief, d.status) for d in summary.delegates] == [
        ("count trips", "running"),
        ("list drivers", "completed"),
    ]
    assert summary.finished_at is None


def test_list_scopes_to_tenant_and_user() -> None:
    app = create_app()
    with TestClient(app) as client:
        store = app.state.harness.run_store
        store.save(_record("run_mine"))
        store.save(_record("run_other_user", user="bob@example.com"))
        store.save(_record("run_other_tenant", tenant="globex"))
        store.save(HarnessRunRecord(run_id="run_legacy", status="completed"))

        resp = client.get("/runs", headers={TENANT: "acme", USER: "ana@example.com"})
    assert resp.status_code == 200
    assert [r["run_id"] for r in resp.json()] == ["run_mine"]


def test_list_filters_by_conversation_status_and_limit() -> None:
    app = create_app()
    with TestClient(app, headers={TENANT: "acme"}) as client:
        store = app.state.harness.run_store
        store.save(_record("run_a", conversation="c1"))
        store.save(_record("run_b", conversation="c2", status="failed"))
        store.save(_record("run_c", conversation="c2"))

        by_conversation = client.get("/runs", params={"conversation_id": "c2"}).json()
        failed = client.get("/runs", params={"status": "failed"}).json()
        both = client.get("/runs", params={"status": "failed,completed", "limit": 2}).json()
        too_many = client.get("/runs", params={"limit": 1000})
    assert {r["run_id"] for r in by_conversation} == {"run_b", "run_c"}
    assert [r["run_id"] for r in failed] == ["run_b"]
    assert len(both) == 2
    assert too_many.status_code == 422


def test_saved_running_record_without_live_run_is_interrupted() -> None:
    app = create_app()
    with TestClient(app, headers={TENANT: "acme"}) as client:
        app.state.harness.run_store.save(_record("run_orphan", status="running"))
        body = client.get("/runs").json()
    assert [(r["run_id"], r["status"]) for r in body] == [("run_orphan", "interrupted")]


class _GatedLoop:
    def __init__(self) -> None:
        self.started = asyncio.Event()
        self.release = asyncio.Event()

    async def run(self, *, user_message, ctx, prior_messages, progress) -> dict[str, Any]:
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="tool.started",
                message="Starting db_query",
                data={"tool": "db_query"},
            )
        )
        self.started.set()
        await self.release.wait()
        return {"answer": "ok", "messages": [AIMessage(content="ok")]}


@pytest.mark.asyncio
async def test_live_runs_come_first_then_finish(tmp_path: Any) -> None:
    loop = _GatedLoop()
    store = JsonRunStore(tmp_path)
    harness = HarnessSupervisor(tools=ToolRegistry(), run_store=store, agent_loop=loop)
    store.save(_record("run_old", status="running"))
    task = asyncio.create_task(
        harness.run(
            UserRequest(
                message="q", tenant_id="acme", user_id="ana@example.com", conversation_id="c9"
            ),
            run_id_override="run_live",
        )
    )
    await asyncio.wait_for(loop.started.wait(), timeout=5)

    listed = _list_runs(
        harness,
        tenant_id="acme",
        user_id="ana@example.com",
        conversation_id=None,
        statuses=None,
        limit=10,
    )
    assert [(s.run_id, s.status) for s in listed] == [
        ("run_live", "running"),
        ("run_old", "interrupted"),
    ]
    assert listed[0].last_step is not None
    assert listed[0].last_step.tool == "db_query"

    loop.release.set()
    await asyncio.wait_for(task, timeout=5)
    listed = _list_runs(
        harness,
        tenant_id="acme",
        user_id=None,
        conversation_id="c9",
        statuses={"completed"},
        limit=10,
    )
    assert [(s.run_id, s.status) for s in listed] == [("run_live", "completed")]
    assert listed[0].finished_at is not None
