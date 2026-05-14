"""HarnessSupervisor — top-level run orchestrator.

Routes incoming requests via either:
- the **LLM intent router** (`LLMIntentRouter`) when injected — the
  Phase-E surface; or
- the **keyword router** (`IntentRouter`) — the Plan 12 default and the
  fallback for "auto" mode below the LLM's confidence threshold.

Then dispatches to:
- `nexo_graph` (NEXO_QUERY, canned data path)
- `agentic_graph` (NEXO_AGENTIC, composable-primitive exploration)
- `meta_agent_node` (NEXO_META, schema/primer questions; no SQL)
- `storytelling` module (STORYTELLING_RUN, mocked narrative path)
- direct response (DIRECT / OTHER)

`conversation_id` is hydrated/appended via `ConversationStore` so
multi-turn chats accumulate context across `/runs` calls.
"""

from __future__ import annotations

import logging
from typing import Any

from langchain_core.language_models import BaseChatModel

from miot_harness.agents.meta_agent import (
    MetaAgentCatalogEntry,
    meta_agent_node,
)
from miot_harness.observability.spans import agent_span
from miot_harness.runtime.context import HarnessContext, UserRequest
from miot_harness.runtime.conversation import (
    ConversationStore,
    ConversationTurn,
)
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.intent_router import LLMIntentRouter
from miot_harness.runtime.mode_resolver import ModeAccessDenied, resolve_mode
from miot_harness.runtime.nexo_graph import instrument_model
from miot_harness.runtime.router import HarnessRoute, IntentRouter, RouteResult
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
        *,
        llm_router: LLMIntentRouter | None = None,
        agentic_graph: Any | None = None,
        meta_model: BaseChatModel | None = None,
        meta_primer: str = "",
        meta_catalog: list[MetaAgentCatalogEntry] | None = None,
        conversation_store: ConversationStore | None = None,
        tenant_lock: str = "mintral",
    ) -> None:
        self.router = router
        self.tools = tools
        self.stories = stories
        self.run_store = run_store
        self.nexo_graph = nexo_graph
        self.llm_router = llm_router
        self.agentic_graph = agentic_graph
        self.meta_model = meta_model
        self.meta_primer = meta_primer
        self.meta_catalog: list[MetaAgentCatalogEntry] = meta_catalog or []
        self.conversation_store = conversation_store
        self.tenant_lock = tenant_lock

    async def run(self, request: UserRequest) -> HarnessRunRecord:
        ctx = request.to_context()
        record = HarnessRunRecord(
            run_id=ctx.run_id,
            status="running",
            conversation_id=request.conversation_id,
        )

        def progress(event: HarnessEvent) -> None:
            record.events.append(event)

        progress(HarnessEvent(run_id=ctx.run_id, type="run.started", message="Run started"))

        # Route via the LLM router when injected; else fall back to the
        # keyword router (Plan 12 default; the "auto" mode confidence
        # fallback also lands here under the hood).
        try:
            route = await self._resolve_route(request)
        except ModeAccessDenied as exc:
            record.answer = str(exc)
            record.status = "completed"
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="answer.completed",
                    message=f"Mode refused: {exc}",
                    data={
                        "mode": request.mode,
                        "tenant_id": request.tenant_id,
                        "reason": "mode_access_denied",
                    },
                )
            )
            self.run_store.save(record)
            return record

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
                await self._run_nexo(request, ctx, record, progress, route.route)
            elif route.route == HarnessRoute.NEXO_META:
                await self._run_nexo_meta(request, ctx, record, progress, route.route)
            elif route.route == HarnessRoute.NEXO_AGENTIC:
                await self._run_nexo_agentic(request, ctx, record, progress, route.route)
            elif route.route == HarnessRoute.STORYTELLING_RUN:
                await self._run_storytelling(ctx, record, progress)
            # DIRECT / OTHER: nothing to do; client renders.
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

        # Persist the turn so the next call in this conversation sees it.
        if self.conversation_store is not None and request.conversation_id and record.answer:
            self.conversation_store.append(
                request.conversation_id,
                ConversationTurn(
                    user_message=request.message,
                    assistant_answer=record.answer,
                ),
            )

        record.status = "completed"
        progress(HarnessEvent(run_id=ctx.run_id, type="run.completed", message="Run completed"))
        self.run_store.save(record)
        return record

    def _root_span_kwargs(
        self, ctx: HarnessContext, route: HarnessRoute | None
    ) -> dict[str, Any]:
        """Common kwargs for `agent_span("run", ...)` across all dispatch paths.

        Centralizes the Langfuse first-class field mapping (E10) so every
        route's root span carries `user_id`, `session_id`, and `tags`
        identically. `tags` includes the resolved route when known.
        """

        tags: list[str] = [f"tenant:{ctx.tenant_id}", f"mode:{ctx.mode}"]
        if route is not None:
            tags.append(f"route:{route.value}")
        return {
            "run_id": ctx.run_id,
            "tenant_id": ctx.tenant_id,
            "mode": ctx.mode,
            "user_id": ctx.user_id,
            "session_id": ctx.conversation_id or ctx.thread_id,
            "tags": tags,
        }

    async def _resolve_route(self, request: UserRequest) -> RouteResult:
        """Use the LLM router when available; else the keyword router.

        The LLM router has its own keyword-fallback for low-confidence,
        so callers don't need to fall back explicitly.
        """

        if self.llm_router is not None:
            return await resolve_mode(
                request,
                llm_router=self.llm_router,
                tenant_lock=self.tenant_lock,
            )
        # Plan 12 default: keyword router on the message; explicit modes
        # are ignored because the keyword router doesn't know about them.
        return self.router.route(request.message)

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
        route: HarnessRoute | None = None,
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
        with agent_span("run", **self._root_span_kwargs(ctx, route)):
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

    async def _run_nexo_agentic(
        self,
        request: UserRequest,
        ctx: HarnessContext,
        record: HarnessRunRecord,
        progress: Any,
        route: HarnessRoute | None = None,
    ) -> None:
        if self.agentic_graph is None:
            answer = (
                "Agentic exploration is currently disabled "
                "(no agentic_graph wired). Try again once it's restored."
            )
            record.answer = answer
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="answer.completed",
                    message="Agentic graph not wired",
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
        with agent_span("run", **self._root_span_kwargs(ctx, route)):
            final_state = await self.agentic_graph.ainvoke(initial_state)

        for evt in final_state.get("_events") or []:
            record.events.append(evt)
        record.answer = final_state.get("answer") or "(no answer produced by agentic graph)"

    async def _run_nexo_meta(
        self,
        request: UserRequest,
        ctx: HarnessContext,
        record: HarnessRunRecord,
        progress: Any,
        route: HarnessRoute | None = None,
    ) -> None:
        if self.meta_model is None:
            answer = (
                "Meta agent is currently disabled "
                "(no meta_model wired). Try again once it's restored."
            )
            record.answer = answer
            return

        # Wrap meta_model with the per-agent telemetry callback so the
        # `anthropic.chat` observation Traceloop auto-emits carries the
        # same `modular.{agent,tenant_id,mode}` + `langfuse.tags` attrs
        # as the canned/agentic paths. Without this, meta-route inner
        # LLM-call cost slips through tenant rollups at observation
        # granularity (the root trace carries them, but the child
        # observation doesn't).
        instrumented_meta_model = instrument_model(self.meta_model, "meta_agent", ctx)

        with agent_span("run", **self._root_span_kwargs(ctx, route)):
            delta = await meta_agent_node(
                {"user_message": request.message},
                model=instrumented_meta_model,
                primer=self.meta_primer,
                catalog=self.meta_catalog,
            )
        record.answer = delta.get("answer") or "(no answer produced by meta agent)"
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="answer.completed",
                message="Meta agent answered",
                data={"length": len(record.answer or "")},
            )
        )
