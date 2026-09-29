"""The run record keeps the last context report even when the run fails."""

from __future__ import annotations

from typing import Any

import pytest

from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.tools.registry import ToolRegistry

_REPORT = {"model": "m", "window": 1000, "used": 100, "ratio": 0.1, "breakdown": {"run": 100}}


class _FailingLoop:
    async def run(self, *, user_message, ctx, prior_messages, progress) -> dict[str, Any]:
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="context.usage",
                message="",
                data={"agent": "agent_loop", "turn": 0, **_REPORT},
            )
        )
        raise RuntimeError("tool blew up")


@pytest.mark.asyncio
async def test_a_failed_run_keeps_its_last_context_report(tmp_path: Any) -> None:
    supervisor = HarnessSupervisor(
        tools=ToolRegistry(),
        run_store=JsonRunStore(tmp_path),
        agent_loop=_FailingLoop(),
        tenant_lock="orion",
    )
    record = await supervisor.run(UserRequest(message="q", tenant_id="orion"))
    assert record.status == "failed"
    assert record.context == _REPORT
