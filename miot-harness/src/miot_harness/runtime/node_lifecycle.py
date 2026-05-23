"""LangGraph node-lifecycle decorator: emits `agent.started` and
`agent.completed` events around any node function so SSE clients can
see graph-node transitions in real time.

Shared by `nexo_graph` and `agentic_graph`. Each node returns a state
delta dict; this wrapper:

1. Reads `ctx` from the state (every node has it).
2. Builds `agent.started` (bookended around the node's own events).
3. Awaits the node — sync or async, both are supported because
   LangGraph itself supports both.
4. Inspects the returned delta to decide `exit_reason`:
   `failure` wins over `next_action`, otherwise `"ok"`.
5. Emits `agent.completed` with the wall-clock duration.

If the node raises, both `agent.started` and a failure-flavored
`agent.completed` are attached to the exception via the
`_harness_lifecycle_events` attribute. The supervisor's outer
exception handler drains them through its `progress` sink before
emitting `run.failed`, so SSE consumers still see the agent
boundary that triggered the failure.
"""

from __future__ import annotations

import inspect
from collections.abc import Callable
from time import monotonic
from typing import Any, Literal, TypeVar, cast

# Private langgraph types — used so the wrapper return satisfies
# `StateGraph[NexoState].add_node` without per-call `# type: ignore`.
# Public symbols don't expose an equivalent today; langgraph's own
# typing notes acknowledge the limitation ("we cannot use either
# TypedDict or dataclass directly due to limitations in type
# checking"). If the private path drifts, swap to the public
# `Runnable[NodeInputT, Any]` overload at the cost of wrapping each
# node in a RunnableLambda.
from langgraph._internal._typing import StateLike
from langgraph.graph._node import _Node

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent

GraphLabel = Literal["nexo", "agentic"]

# Generic over the graph state type so `StateGraph[NexoState].add_node`
# accepts the wrapped node without per-call `# type: ignore`. Bounded
# to `StateLike` (TypedDict / dataclass / pydantic BaseModel) because
# that's what `_Node[S]` requires; in practice we only ever pass
# `NexoState` (a `TypedDict`).
S = TypeVar("S", bound=StateLike)


def wrap_node_with_lifecycle(
    name: str, fn: Callable[[S], Any], graph_label: GraphLabel
) -> _Node[S]:
    async def wrapped(state: S) -> S:
        # Cast once at the boundary so the internal dict/TypedDict
        # accesses (`state["ctx"]`, `state.get("turn_count", ...)`)
        # type-check; `S` itself is opaque to mypy.
        snapshot = cast("dict[str, Any]", state)
        ctx: HarnessContext = snapshot["ctx"]
        turn = int(snapshot.get("turn_count", 0) or 0)
        started_event = HarnessEvent(
            run_id=ctx.run_id,
            type="agent.started",
            message=f"Entering {name}",
            data={"agent": name, "graph": graph_label, "turn": turn},
        )
        start = monotonic()
        try:
            result = fn(state)
            delta = await result if inspect.isawaitable(result) else result
        except Exception as exc:
            # We can't return a state delta on failure (LangGraph never
            # sees a partial dict), and `ctx` doesn't expose a progress
            # sink. Stash the boundary events on the exception so the
            # supervisor's outer except can drain them before run.failed.
            duration_ms = int((monotonic() - start) * 1000)
            failed_event = HarnessEvent(
                run_id=ctx.run_id,
                type="agent.completed",
                message=f"Failed {name}",
                data={
                    "agent": name,
                    "graph": graph_label,
                    "duration_ms": duration_ms,
                    "exit_reason": "failure",
                    "error": str(exc),
                },
            )
            exc._harness_lifecycle_events = [started_event, failed_event]  # type: ignore[attr-defined]
            raise
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
        # State deltas are dict-shaped at runtime — LangGraph reducers
        # narrow them back into `S` (NexoState / etc.) when applied.
        return cast("S", merged)

    wrapped.__name__ = f"_lifecycle_{name}"
    return cast("_Node[S]", wrapped)
