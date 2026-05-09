from typing import Literal

from pydantic import BaseModel

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool, Progress


class WorkflowBottlenecksInput(BaseModel):
    period: Literal["this_month", "last_month", "last_30_days"]


class WorkflowBottlenecksOutput(BaseModel):
    top_bottleneck: str
    top_bottleneck_share: float
    affected_deliveries: int


async def _permission(_: HarnessContext, __: WorkflowBottlenecksInput) -> PermissionResult:
    return PermissionResult.allow("Tenant-scoped read-only workflow query.")


async def _call(
    _: HarnessContext,
    __: WorkflowBottlenecksInput,
    ___: Progress,
) -> WorkflowBottlenecksOutput:
    return WorkflowBottlenecksOutput(
        top_bottleneck="dock check-in waiting time",
        top_bottleneck_share=42.5,
        affected_deliveries=11,
    )


def get_workflow_bottlenecks_tool() -> HarnessTool[
    WorkflowBottlenecksInput,
    WorkflowBottlenecksOutput,
]:
    return HarnessTool(
        name="get_workflow_bottlenecks",
        description="Read tenant-scoped workflow delay and bottleneck signals.",
        input_model=WorkflowBottlenecksInput,
        output_model=WorkflowBottlenecksOutput,
        read_only=True,
        check_permission=_permission,
        call=_call,
    )
