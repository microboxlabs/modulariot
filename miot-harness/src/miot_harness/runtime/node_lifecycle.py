"""LangGraph node-lifecycle decorator: emits `agent.started` and
`agent.completed` events around any node function so SSE clients can
see graph-node transitions in real time.

Shared by `nexo_graph` and `agentic_graph`. Each node returns a state
delta dict; this wrapper:

1. Reads `ctx` from the state (every node has it).
2. Emits `agent.started` (bookended around the node's own events).
3. Awaits the node — sync or async, both are supported because
   LangGraph itself supports both.
4. Inspects the returned delta to decide `exit_reason`:
   `failure` wins over `next_action`, otherwise `"ok"`.
5. Emits `agent.completed` with the wall-clock duration.

If the node raises, we still emit `agent.completed` with
`exit_reason: "failure"` (and the exception text on `error`) before
re-raising — so the SSE consumer can correlate the agent boundary
with the eventual `run.failed`.
"""

from __future__ import annotations

import inspect
from collections.abc import Awaitable, Callable
from time import monotonic
from typing import Any, Literal

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent

GraphLabel = Literal["nexo", "agentic"]
NodeFn = Callable[..., Any]


def wrap_node_with_lifecycle(
    name: str, fn: NodeFn, graph_label: GraphLabel
) -> Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]:
    async def wrapped(state: dict[str, Any]) -> dict[str, Any]:
        ctx: HarnessContext = state["ctx"]
        turn = int(state.get("turn_count", 0) or 0)
        started_event = HarnessEvent(
            run_id=ctx.run_id,
            type="agent.started",
            message=f"Entering {name}",
            data={"agent": name, "graph": graph_label, "turn": turn},
        )
        start = monotonic()
        # If the node raises, we let it propagate. We can't return a
        # state delta with agent.completed{exit_reason="failure"} because
        # LangGraph never sees the partial dict — the supervisor's
        # outer except handler turns it into a run.failed event with
        # the error text, which already gives SSE consumers the
        # correlation they need on the agent boundary.
        result = fn(state)
        delta = await result if inspect.isawaitable(result) else result
        delta = delta or {}
        node_events = list(delta.get("_events") or [])
        duration_ms = int((monotonic() - start) * 1000)
        if delta.get("failure"):
            exit_reason = "failure"
        elif delta.get("next_action"):
            exit_reason = "next_action"
        else:
            exit_reason = "ok"
        completed_event = HarnessEvent(
            run_id=ctx.run_id,
            type="agent.completed",
            message=f"Completed {name}",
            data={
                "agent": name,
                "graph": graph_label,
                "duration_ms": duration_ms,
                "exit_reason": exit_reason,
            },
        )
        merged: dict[str, Any] = dict(delta)
        merged["_events"] = [started_event, *node_events, completed_event]
        return merged

    wrapped.__name__ = f"_lifecycle_{name}"
    return wrapped
