from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.tool import Progress
from miot_harness.storytelling.contracts import (
    ApprovalProposal,
    EvidenceRef,
    StoryArtifact,
    StoryMetric,
    StorySection,
    WidgetDraft,
)
from miot_harness.tools.dashboard import DashboardWidgetDraftInput, DashboardWidgetDraftOutput
from miot_harness.tools.delivery_metrics import DeliveryMetricsInput, DeliveryMetricsOutput
from miot_harness.tools.registry import ToolRegistry
from miot_harness.tools.workflow_events import WorkflowBottlenecksInput, WorkflowBottlenecksOutput


class StorytellingModule:
    async def create_delivery_compliance_story(
        self,
        ctx: HarnessContext,
        tools: ToolRegistry,
        progress: Progress,
    ) -> StoryArtifact:
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="tool.started",
                message="Composing delivery compliance story",
            )
        )

        metrics = await tools.invoke(
            "get_delivery_compliance_metrics",
            ctx,
            DeliveryMetricsInput(period="this_month").model_dump(),
            progress,
        )
        bottlenecks = await tools.invoke(
            "get_workflow_bottlenecks",
            ctx,
            WorkflowBottlenecksInput(period="this_month").model_dump(),
            progress,
        )
        widget = await tools.invoke(
            "create_dashboard_widget_draft",
            ctx,
            DashboardWidgetDraftInput(
                metric="delivery_compliance_rate",
                title="Delivery Compliance This Month",
            ).model_dump(),
            progress,
        )

        assert isinstance(metrics, DeliveryMetricsOutput)
        assert isinstance(bottlenecks, WorkflowBottlenecksOutput)
        assert isinstance(widget, DashboardWidgetDraftOutput)

        evidence = [
            EvidenceRef(
                id="ev_delivery_metrics",
                label="Delivery compliance metric sample",
                source="mock:delivery_metrics",
                query="period=this_month",
            ),
            EvidenceRef(
                id="ev_workflow_bottlenecks",
                label="Workflow bottleneck sample",
                source="mock:workflow_events",
                query="period=this_month",
            ),
        ]

        story = StoryArtifact(
            title="Delivery Compliance This Month",
            summary=(
                f"Compliance is {metrics.compliance_rate:.1f}% with "
                f"{metrics.late_deliveries} late deliveries. The main bottleneck is "
                f"{bottlenecks.top_bottleneck}."
            ),
            metrics=[
                StoryMetric(
                    label="Compliance rate",
                    value=f"{metrics.compliance_rate:.1f}%",
                    trend=metrics.trend,
                    evidence_id="ev_delivery_metrics",
                ),
                StoryMetric(
                    label="Late deliveries",
                    value=str(metrics.late_deliveries),
                    trend="down" if metrics.late_deliveries_delta < 0 else "up",
                    evidence_id="ev_delivery_metrics",
                ),
            ],
            sections=[
                StorySection(
                    title="What changed",
                    body=(
                        "Delivery compliance improved against the previous comparable "
                        "period, but remains sensitive to handoff delays."
                    ),
                    evidence_ids=["ev_delivery_metrics"],
                ),
                StorySection(
                    title="Where the operation slows down",
                    body=(
                        f"The largest workflow bottleneck is {bottlenecks.top_bottleneck}, "
                        f"representing {bottlenecks.top_bottleneck_share:.1f}% of observed delays."
                    ),
                    evidence_ids=["ev_workflow_bottlenecks"],
                ),
                StorySection(
                    title="Recommended dashboard addition",
                    body=(
                        "Add a compact compliance metric widget with late-delivery context "
                        "so dispatchers can scan month-to-date health quickly."
                    ),
                    evidence_ids=["ev_delivery_metrics", "ev_workflow_bottlenecks"],
                ),
            ],
            evidence=evidence,
            widget_drafts=[
                WidgetDraft(
                    title=widget.title,
                    kind=widget.kind,
                    description=widget.description,
                    config=widget.config,
                    evidence_ids=["ev_delivery_metrics"],
                )
            ],
            approval_proposals=[
                ApprovalProposal(
                    action="apply_dashboard_patch",
                    reason="Adding dashboard widgets changes the user's dashboard layout.",
                    payload={"widgets": [widget.model_dump()]},
                )
            ],
        )

        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="tool.completed",
                message="Composed delivery compliance story",
            )
        )
        return story
