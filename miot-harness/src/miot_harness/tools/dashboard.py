from typing import Literal

from pydantic import BaseModel, Field

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool, Progress


class DashboardContextInput(BaseModel):
    dashboard_id: str | None = None


class DashboardContextOutput(BaseModel):
    dashboard_id: str
    existing_widgets: list[str] = Field(default_factory=list)


class DashboardWidgetDraftInput(BaseModel):
    metric: str
    title: str


class DashboardWidgetDraftOutput(BaseModel):
    title: str
    kind: Literal["metric", "bar", "line", "table"]
    description: str
    config: dict[str, object]


class DashboardPatchInput(BaseModel):
    dashboard_id: str
    widgets: list[DashboardWidgetDraftOutput]
    approval_id: str | None = None


class DashboardPatchOutput(BaseModel):
    applied: bool
    dashboard_id: str
    message: str


async def _read_permission(_: HarnessContext, __: BaseModel) -> PermissionResult:
    return PermissionResult.allow("Read-only dashboard capability.")


async def _apply_permission(_: HarnessContext, value: DashboardPatchInput) -> PermissionResult:
    if value.approval_id:
        return PermissionResult.allow("User approval is attached.")
    return PermissionResult.ask("Applying a dashboard patch requires explicit user approval.")


async def _dashboard_context_call(
    _: HarnessContext,
    value: DashboardContextInput,
    __: Progress,
) -> DashboardContextOutput:
    return DashboardContextOutput(
        dashboard_id=value.dashboard_id or "demo-dashboard",
        existing_widgets=["fleet_status", "late_tasks"],
    )


async def _widget_draft_call(
    _: HarnessContext,
    value: DashboardWidgetDraftInput,
    __: Progress,
) -> DashboardWidgetDraftOutput:
    return DashboardWidgetDraftOutput(
        title=value.title,
        kind="metric",
        description="Month-to-date delivery compliance with late-delivery context.",
        config={
            "metric": value.metric,
            "format": "percent",
            "comparison": "previous_period",
            "secondaryMetric": "late_deliveries",
        },
    )


async def _apply_patch_call(
    _: HarnessContext,
    value: DashboardPatchInput,
    __: Progress,
) -> DashboardPatchOutput:
    message = (
        "Dashboard patch accepted for application." if value.approval_id else "Approval required."
    )
    return DashboardPatchOutput(
        applied=bool(value.approval_id),
        dashboard_id=value.dashboard_id,
        message=message,
    )


def get_dashboard_context_tool() -> HarnessTool[DashboardContextInput, DashboardContextOutput]:
    return HarnessTool(
        name="get_dashboard_context",
        description="Read dashboard context for widget recommendations.",
        input_model=DashboardContextInput,
        output_model=DashboardContextOutput,
        read_only=True,
        check_permission=_read_permission,
        call=_dashboard_context_call,
    )


def create_dashboard_widget_draft_tool() -> HarnessTool[
    DashboardWidgetDraftInput,
    DashboardWidgetDraftOutput,
]:
    return HarnessTool(
        name="create_dashboard_widget_draft",
        description="Create a dashboard widget draft artifact without mutating the dashboard.",
        input_model=DashboardWidgetDraftInput,
        output_model=DashboardWidgetDraftOutput,
        read_only=True,
        check_permission=_read_permission,
        call=_widget_draft_call,
    )


def apply_dashboard_patch_tool() -> HarnessTool[DashboardPatchInput, DashboardPatchOutput]:
    return HarnessTool(
        name="apply_dashboard_patch",
        description="Apply an approved dashboard widget patch.",
        input_model=DashboardPatchInput,
        output_model=DashboardPatchOutput,
        read_only=False,
        check_permission=_apply_permission,
        call=_apply_patch_call,
    )
