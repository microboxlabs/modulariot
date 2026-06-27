"""End-to-end: live steering + interrupt over HTTP against a REAL agentic run.

These tests drive an actual agentic graph (planner → executor → freshness_judge
→ planner → synthesizer) dispatched as a background task by ``POST /runs:start``,
and exercise the Plan C steering channel *mid-run*:

  - ``POST /runs/{run_id}/steer``     pushes an operator note into the loop.
  - ``POST /runs/{run_id}/interrupt`` requests a cooperative stop.

Deterministic mid-run timing — NO sleeps
-----------------------------------------
A steer/interrupt is consumed at the *next agentic planner boundary*. To inject
one deterministically, the run must actually pause and yield. We reuse the
harness's proven synchronization point: a tool whose ``check_permission``
returns ``ask`` parks the run on ``await event.wait()`` inside the executor node
(``HarnessTool.invoke`` registers the decision on the shared
``RunControlRegistry`` and blocks). The graph's ``ainvoke`` genuinely blocks
there until a human resolves the decision over HTTP.

We detect that parked state by polling the *shared* ``RunControlRegistry`` for a
pending entry scoped to this run (this is the same registry the FastAPI app owns
and the executor registered on — not a sleep). Once parked, we POST the
steer/interrupt, then resolve the decision over HTTP so the loop advances to the
turn-2 planner boundary where the steer note is drained / the interrupt flag is
honored.

Scripted model
--------------
A ``FakeListChatModel`` planner takes two turns: turn 1 → ``call_tool`` on the
``ask`` tool; turn 2 → ``final`` (so the run synthesizes). The synthesizer model
returns a canned answer. A recording subclass captures the messages each planner
``ainvoke`` receives so Test A can assert the operator note reached the turn-2
LLM call as a ``HumanMessage``.

Concurrency
-----------
Live in-flight dispatch + the SSE stream + the background run task must share one
event loop, so we drive everything through ``httpx.AsyncClient`` over
``ASGITransport`` while the ``TestClient`` context keeps the lifespan active —
the exact approach the (skipped) live-stream test in test_runs_stream.py uses.

The agentic graph buffers each node's events and drains them into the run record
only after ``ainvoke`` returns, so ``steering.injected`` / ``run.interrupted``
surface on the SSE stream once the run completes; we read the stream (replay)
after the run is terminal and assert on the full event sequence.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from langchain_core.language_models import FakeListChatModel
from pydantic import BaseModel

from miot_harness.config import HarnessSettings, get_settings
from miot_harness.integrations.nexo.provider import NEXO_PROFILE
from miot_harness.runtime.agentic_graph import build_agentic_graph
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.intent_router import LLMIntentRouter
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool
from miot_harness.tools.registry import ToolRegistry

# Mirror test_runs_stream._parse_sse so the SSE drain helper is self-contained.
from tests.api.test_runs_stream import _parse_sse

TENANT = NEXO_PROFILE.tenant_lock  # "mintral" — the data-touching tenant lock
TOOL_NAME = f"{NEXO_PROFILE.tool_prefix}probe"  # "coordinador_probe" → curated


@pytest.fixture(autouse=True)
def _clean(tmp_path: Any, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_DSN", raising=False)
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_KIND", raising=False)
    monkeypatch.delenv("MIOT_HARNESS_IDENTITY_SIGNING_KEY", raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


# ---------------------------------------------------------------------------
# Scripted model + ask-tool + agentic graph wiring
# ---------------------------------------------------------------------------


def _call_tool_response() -> str:
    return json.dumps(
        {
            "action": "call_tool",
            "tool": TOOL_NAME,
            "args": {},
            "intent": "fetch overview",
            "rationale": "broad question",
        }
    )


_FINAL_RESPONSE = json.dumps({"action": "final", "reasoning": "evidence suffices"})


class _RecordingPlanner(FakeListChatModel):
    """A planner model that records the messages each ainvoke receives.

    FakeListChatModel is a pydantic model, so per-instance mutable state is
    awkward; we stash captures on the class (each test builds a fresh instance,
    which resets them in __init__).
    """

    def __init__(self, *, responses: list[str]) -> None:
        super().__init__(responses=responses)
        _RecordingPlanner._captured = []  # type: ignore[attr-defined]

    async def ainvoke(self, input, *args, **kwargs):  # type: ignore[override, no-untyped-def]
        _RecordingPlanner._captured.append(list(input))  # type: ignore[attr-defined]
        return await super().ainvoke(input, *args, **kwargs)


def _ask_tool() -> HarnessTool[Any, Any]:
    """A curated tool whose check_permission returns `ask`, so an agentic run
    parks on the RunControlRegistry until resolved over HTTP."""

    class _In(BaseModel):
        pass

    class _Out(BaseModel):
        rows: list[dict[str, Any]] = []
        refreshed_at: datetime | None = None
        source: str = "Coordinador · nexo (Citus DB)"

    async def _check(_ctx: HarnessContext, _inp: Any) -> PermissionResult:
        return PermissionResult.ask("needs operator approval")

    async def _call(_ctx: HarnessContext, _inp: Any, _progress: Any) -> Any:
        return _Out(rows=[{"n_eta_riesgo": 3}], refreshed_at=datetime.now(UTC))

    return HarnessTool(
        name=TOOL_NAME,
        description="[Layer L1] KPI probe",
        input_model=_In,
        output_model=_Out,
        check_permission=_check,
        call=_call,
        kind="curated",
    )


def _wire_agentic(app: Any, planner: FakeListChatModel) -> None:
    """Replace the (disabled) harness graph with a real agentic graph backed by
    a scripted planner + the ask-tool, and make the supervisor route explicit
    ``mode="agentic"`` requests to DATA_AGENTIC.

    The datasource is disabled in this test (no DSN), so the lifespan never
    booted an agentic_graph / llm_router; we slot controllable ones in after the
    lifespan is active (the same after-lifespan-injection pattern the skipped
    live-stream test in test_runs_stream.py uses for data_graph).
    """

    harness = app.state.harness
    registry = ToolRegistry()
    registry.register(_ask_tool())
    harness.tools = registry

    models = {
        "planner": planner,
        "critic": FakeListChatModel(responses=[]),
        "synthesizer": FakeListChatModel(responses=["Estado operativo resumido."]),
        "summarizer": FakeListChatModel(responses=[]),
    }
    harness.agentic_graph = build_agentic_graph(
        settings=HarnessSettings(agents_synthesizer_stream=False),
        models=models,
        provenance_log=None,
        profile=NEXO_PROFILE,
        registry=registry,
    )
    # `mode="agentic"` short-circuits resolve_mode before the router is ever
    # invoked; we only need a non-None llm_router so the supervisor takes the
    # resolve_mode path (and tenant_lock to pass its data-touching gate). The
    # FakeListChatModel here is never called.
    harness.llm_router = LLMIntentRouter(
        FakeListChatModel(responses=["{}"]), profile=NEXO_PROFILE
    )
    harness.tenant_lock = TENANT


# ---------------------------------------------------------------------------
# Mid-run sync + SSE drain helpers
# ---------------------------------------------------------------------------


async def _wait_for_pending_decision(app: Any, run_id: str, *, timeout: float = 5.0) -> str:
    """Poll the SHARED RunControlRegistry until the agentic run parks on a
    pending tool-approval decision for `run_id`, and return its decision_id.

    This is the deterministic mid-run synchronization point: the executor node
    registered the decision and is blocked on ``await event.wait()`` — there is
    no sleep. A bounded loop fails fast if the run never parks.
    """

    registry = app.state.harness.approval_registry
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        pending = registry._pending  # type: ignore[attr-defined]
        for decision_id, entry in list(pending.items()):
            if entry.run_id == run_id and not entry.event.is_set():
                return decision_id
        await asyncio.sleep(0)
    pytest.fail(f"run {run_id} never parked on a pending tool-approval decision")


async def _read_stream(client: httpx.AsyncClient, run_id: str) -> list[dict[str, Any]]:
    """Read the (terminal) SSE stream to completion and parse it. Bounded by an
    outer wait_for so a hung stream fails the test fast rather than blocking."""

    async def _drain() -> list[dict[str, Any]]:
        async with client.stream("GET", f"/runs/{run_id}/stream") as resp:
            assert resp.status_code == 200, resp.status_code
            buffer = b""
            async for chunk in resp.aiter_bytes():
                buffer += chunk
        return _parse_sse(buffer.decode())

    return await asyncio.wait_for(_drain(), timeout=5.0)


# ---------------------------------------------------------------------------
# Test A — steer reaches the running loop
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_steer_reaches_running_loop_and_injects_note() -> None:
    """A steer POSTed while the run is parked at the turn-1 tool-approval pause
    is drained at the turn-2 planner boundary: the run emits `steering.injected`
    for that note, reaches a terminal `run.completed`, and the note text reaches
    the turn-2 model call as a HumanMessage.
    """

    note = "focus only on overdue ETA services"
    planner = _RecordingPlanner(responses=[_call_tool_response(), _FINAL_RESPONSE])

    from miot_harness.api.server import create_app

    app = create_app()
    with TestClient(app):  # keeps the lifespan active
        _wire_agentic(app, planner)
        assert app.state.event_bus is not None, "SSE bus must be wired for /stream"

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            # 1. Start a REAL agentic run (background task).
            start = await client.post(
                "/runs:start",
                json={"message": "estado operativo?", "mode": "agentic", "tenant_id": TENANT},
            )
            assert start.status_code == 202, start.text
            run_id = start.json()["run_id"]

            # 2. Wait until the loop parks at the turn-1 approval (deterministic;
            #    no sleep) and grab the pending decision_id.
            decision_id = await _wait_for_pending_decision(app, run_id)

            # 3. Steer the running loop. The run is parked → this lands on the
            #    open steering channel and is accepted (202).
            steer = await client.post(f"/runs/{run_id}/steer", json={"message": note})
            assert steer.status_code == 202, steer.text

            # 4. Resolve the approval so the tool completes and the loop advances
            #    to the turn-2 planner where the note is drained.
            approve = await client.post(
                f"/runs/{run_id}/decisions/{decision_id}",
                json={"resolution": "approve"},
            )
            assert approve.status_code == 204, approve.text

            # 5. Let the background run finish, then read its SSE stream.
            await asyncio.wait_for(app.state.in_flight[run_id], timeout=5.0)
            records = await _read_stream(client, run_id)

    event_types = [r["event"] for r in records]
    # The steer was injected at the turn-2 planner boundary.
    injected = [r for r in records if r["event"] == "steering.injected"]
    assert len(injected) == 1, f"expected one steering.injected, got {event_types}"
    # _parse_sse exposes the event's `type` as r["event"] and the whole
    # serialized HarnessEvent as r["data"]; the event's own payload is nested
    # at r["data"]["data"].
    assert injected[0]["data"]["data"]["note"] == note
    # The run reached a terminal completion (partial/full synthesis path).
    assert "run.completed" in event_types, event_types
    assert event_types[-1] == "run.completed", event_types
    # No hard failure on the happy path.
    assert "run.failed" not in event_types, event_types

    # Preferred extra assertion: the note text reached the turn-2 model call.
    # The recording planner captured two ainvokes; the second (turn 2) must
    # carry the operator guidance as a HumanMessage.
    captured = _RecordingPlanner._captured  # type: ignore[attr-defined]
    assert len(captured) == 2, f"planner should run twice, ran {len(captured)}"
    turn2_msgs = captured[1]
    assert any(note in str(getattr(m, "content", "")) for m in turn2_msgs), (
        "operator note did not reach the turn-2 planner LLM call"
    )


# ---------------------------------------------------------------------------
# Test B — interrupt yields a graceful partial-answer stop
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_interrupt_yields_graceful_partial_answer_stop() -> None:
    """An interrupt POSTed while the run is parked at the turn-1 approval is
    honored at the turn-2 planner boundary: because turn 1 produced evidence,
    the run routes to partial-answer synthesis, emits `run.interrupted`, then a
    terminal `run.completed`. It must NOT hard-fail with reason=cancelled (the
    distinct /cancel path).
    """

    planner = FakeListChatModel(responses=[_call_tool_response(), _FINAL_RESPONSE])

    from miot_harness.api.server import create_app

    app = create_app()
    with TestClient(app):
        _wire_agentic(app, planner)
        assert app.state.event_bus is not None

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            start = await client.post(
                "/runs:start",
                json={"message": "estado operativo?", "mode": "agentic", "tenant_id": TENANT},
            )
            assert start.status_code == 202, start.text
            run_id = start.json()["run_id"]

            decision_id = await _wait_for_pending_decision(app, run_id)

            # Request a cooperative interrupt while parked.
            interrupt = await client.post(f"/runs/{run_id}/interrupt")
            assert interrupt.status_code == 202, interrupt.text

            # Resolve the approval so the loop advances to the turn-2 planner
            # boundary, where the interrupt is honored.
            approve = await client.post(
                f"/runs/{run_id}/decisions/{decision_id}",
                json={"resolution": "approve"},
            )
            assert approve.status_code == 204, approve.text

            await asyncio.wait_for(app.state.in_flight[run_id], timeout=5.0)
            records = await _read_stream(client, run_id)

    event_types = [r["event"] for r in records]
    # The interrupt was honored at the turn-2 planner boundary.
    assert "run.interrupted" in event_types, event_types
    interrupted = next(r for r in records if r["event"] == "run.interrupted")
    # Turn 1 produced evidence → partial-answer synthesis path. The event's own
    # payload is nested at r["data"]["data"] (see _parse_sse note above).
    assert interrupted["data"]["data"]["had_evidence"] is True, interrupted["data"]
    # Terminal completion via the synthesis path (NOT a failure).
    assert "run.completed" in event_types, event_types
    assert event_types[-1] == "run.completed", event_types
    # run.interrupted precedes the terminal completion.
    assert event_types.index("run.interrupted") < event_types.index("run.completed")
    # The graceful-stop path must NOT hard-fail, and must NOT be the /cancel
    # path (reason=cancelled).
    failed = [r for r in records if r["event"] == "run.failed"]
    assert not failed, f"interrupt must not hard-fail: {failed}"
    assert all(
        r.get("data", {}).get("data", {}).get("reason") != "cancelled" for r in records
    ), "interrupt must not surface reason=cancelled (that is the /cancel path)"
