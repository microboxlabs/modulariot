from __future__ import annotations

import asyncio

import pytest

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.control import Resolution, RunControlRegistry
from miot_harness.runtime.events import HarnessEvent


@pytest.mark.asyncio
async def test_request_choice_returns_selected_option() -> None:
    reg = RunControlRegistry()
    events: list[HarnessEvent] = []
    ctx = HarnessContext(
        thread_id="t", tenant_id="acme", user_id="u", run_id="r1", approval_registry=reg
    )

    async def resolve_soon() -> None:
        for _ in range(200):
            ids = [e.data["decision_id"] for e in events if e.type == "decision.requested"]
            if ids:
                reg.resolve(ids[0], Resolution(action="choose", option_id="b"), "r1")
                return
            await asyncio.sleep(0.005)

    asyncio.create_task(resolve_soon())
    chosen = await ctx.request_choice(
        "pick a plan",
        options=[{"id": "a", "label": "A", "description": ""},
                 {"id": "b", "label": "B", "description": ""}],
        progress=events.append,
    )
    assert chosen == "b"
    assert any(
        e.type == "decision.requested" and e.data.get("kind") == "choice" for e in events
    )
    assert any(e.type == "decision.resolved" for e in events)


@pytest.mark.asyncio
async def test_request_choice_returns_none_without_registry() -> None:
    ctx = HarnessContext(thread_id="t", tenant_id="acme", user_id="u", run_id="r1")
    chosen = await ctx.request_choice(
        "pick",
        options=[{"id": "a", "label": "A", "description": ""}],
        progress=lambda e: None,
    )
    assert chosen is None
