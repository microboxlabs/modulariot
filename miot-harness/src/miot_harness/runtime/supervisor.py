"""HarnessSupervisor — top-level run orchestrator.

Routes incoming requests via the IntentRouter, then dispatches to:
  - storytelling module (legacy mocked flow)
  - compiled Nexo conversational graph (added in plan 12 / Phase D)
  - or returns a direct response (current default)

The Nexo graph is injected as an optional dependency. When None
(MIOT_HARNESS_NEXO_DB_SCRIPTS_ROOT unset, or boot failed), Nexo
queries get a graceful "integration disabled" answer rather than
500-ing.
"""

from __future__ import annotations

import logging
from typing import Any

from miot_harness.runtime.context import HarnessContext, UserRequest
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.router import HarnessRoute, IntentRouter
from miot_harness.runtime.run_store import HarnessRunRecord, JsonRunStore
from miot_harness.storytelling.module import StorytellingModule
from miot_harness.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


class HarnessSupervisor:
    def __init__(
        self,
        router: IntentRouter,
        tools: ToolRegistry,
        stories: StorytellingModule,
        run_store: JsonRunStore,
        nexo_graph: Any | None = None,
    ) -> None:
        self.router = router
        self.tools = tools
        self.stories = stories
        self.run_store = run_store
        self.nexo_graph = nexo_graph

    async def run(self, request: UserRequest) -> HarnessRunRecord:
        ctx = request.to_context()
        record = HarnessRunRecord(run_id=ctx.run_id, status="running")

        def progress(event: HarnessEvent) -> None:
            record.events.append(event)

        progress(HarnessEvent(run_id=ctx.run_id, type="run.started", message="Run started"))
        route = self.router.route(request.message)
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="route.selected",
                message=route.reason,
                data={"route": route.route},
            )
        )

        try:
            if route.route == HarnessRoute.NEXO_QUERY:
                await self._run_nexo(request, ctx, record, progress)
            elif route.route == HarnessRoute.STORYTELLING_RUN:
                await self._run_storytelling(ctx, record, progress)
            # DIRECT route: nothing to do; client renders.
        except Exception as exc:  # noqa: BLE001 — supervisor must not propagate
            logger.exception("HarnessSupervisor.run failed")
            record.status = "failed"
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="run.failed",
                    message=f"Run failed: {exc}",
                    data={"error": str(exc)},
                )
            )
            self.run_store.save(record)
            return record

        record.status = "completed"
        progress(HarnessEvent(run_id=ctx.run_id, type="run.completed", message="Run completed"))
        self.run_store.save(record)
        return record

    async def _run_storytelling(
        self,
        ctx: HarnessContext,
        record: HarnessRunRecord,
        progress: Any,
    ) -> None:
        story = await self.stories.create_delivery_compliance_story(ctx, self.tools, progress)
        record.artifacts.append(story.model_dump())
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="artifact.created",
                message="Created delivery compliance story artifact",
                data={"artifact_id": story.id},
            )
        )

    async def _run_nexo(
        self,
        request: UserRequest,
        ctx: HarnessContext,
        record: HarnessRunRecord,
        progress: Any,
    ) -> None:
        if self.nexo_graph is None:
            answer = (
                "Coordinador integration is currently disabled "
                "(no DB tunnel or boot failed). Try again once it's restored."
            )
            record.answer = answer
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="answer.completed",
                    message="Nexo integration disabled",
                    data={"length": len(answer)},
                )
            )
            return

        initial_state: dict[str, Any] = {
            "user_message": request.message,
            "ctx": ctx,
            "evidence": [],
            "turn_count": 0,
        }
        final_state = await self.nexo_graph.ainvoke(initial_state)

        # Drain the graph's _events channel into the run record in order
        for evt in final_state.get("_events") or []:
            record.events.append(evt)

        answer = final_state.get("answer")
        if answer:
            record.answer = answer
        else:
            record.answer = "(no answer produced by Coordinador graph)"

        # Persist NexoPlan in artifacts (review item N12)
        plan = final_state.get("plan")
        if plan is not None and hasattr(plan, "model_dump"):
            record.artifacts.append({"type": "nexo_plan", **plan.model_dump()})
