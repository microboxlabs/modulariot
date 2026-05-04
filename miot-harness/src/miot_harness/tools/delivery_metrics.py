from typing import Literal

from pydantic import BaseModel

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool, Progress


class DeliveryMetricsInput(BaseModel):
    period: Literal["this_month", "last_month", "last_30_days"]


class DeliveryMetricsOutput(BaseModel):
    compliance_rate: float
    compliance_rate_delta: float
    late_deliveries: int
    late_deliveries_delta: int
    trend: Literal["up", "down", "flat"]


async def _permission(_: HarnessContext, __: DeliveryMetricsInput) -> PermissionResult:
    return PermissionResult.allow("Tenant-scoped read-only metrics query.")


async def _call(
    _: HarnessContext,
    __: DeliveryMetricsInput,
    ___: Progress,
) -> DeliveryMetricsOutput:
    return DeliveryMetricsOutput(
        compliance_rate=91.7,
        compliance_rate_delta=3.4,
        late_deliveries=18,
        late_deliveries_delta=-6,
        trend="up",
    )


def get_delivery_compliance_metrics_tool() -> HarnessTool[
    DeliveryMetricsInput,
    DeliveryMetricsOutput,
]:
    return HarnessTool(
        name="get_delivery_compliance_metrics",
        description="Read tenant-scoped delivery compliance metrics for a period.",
        input_model=DeliveryMetricsInput,
        output_model=DeliveryMetricsOutput,
        read_only=True,
        check_permission=_permission,
        call=_call,
    )
