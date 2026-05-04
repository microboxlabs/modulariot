from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.router import HarnessRoute, IntentRouter
from miot_harness.runtime.run_store import HarnessRunRecord, JsonRunStore
from miot_harness.storytelling.module import StorytellingModule
from miot_harness.tools.registry import ToolRegistry


class HarnessSupervisor:
    def __init__(
        self,
        router: IntentRouter,
        tools: ToolRegistry,
        stories: StorytellingModule,
        run_store: JsonRunStore,
    ) -> None:
        self.router = router
        self.tools = tools
        self.stories = stories
        self.run_store = run_store

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

        if route.route == HarnessRoute.STORYTELLING_RUN:
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

        record.status = "completed"
        progress(HarnessEvent(run_id=ctx.run_id, type="run.completed", message="Run completed"))
        self.run_store.save(record)
        return record

