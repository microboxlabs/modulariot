"""`dashboard_draft`: offer the user a dashboard made of widgets shown in the thread.

Nothing is saved here. A `dashboard.draft` event names the widgets; the app
lays them out, shows a preview, and saves the dashboard with the user's own
session when they confirm, so the user stays in control of what is created.
"""

from __future__ import annotations

import re
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool, Progress

MAX_DASHBOARD_WIDGETS = 12
WIDGET_ID_PATTERN = r"^w[0-9a-f]{10}$"


class DashboardDraftInput(BaseModel):
    title: str = Field(
        min_length=1, max_length=120, description="The dashboard's name, user's language"
    )
    description: str = Field(
        default="", max_length=400, description="One sentence on what the dashboard shows"
    )
    widgets: list[str] = Field(
        min_length=1,
        max_length=MAX_DASHBOARD_WIDGETS,
        description=(
            "Ids of widgets already shown in this thread (the widget_id a `<connection>_show` "
            "call returned), in the order they should appear: KPIs first, then charts, then tables"
        ),
    )

    @field_validator("widgets")
    @classmethod
    def _widget_ids(cls, ids: list[str]) -> list[str]:
        bad = [i for i in ids if not re.match(WIDGET_ID_PATTERN, i)]
        if bad:
            raise ValueError(
                f"not widget ids: {', '.join(bad)}; use the widget_id a show call returned"
            )
        return list(dict.fromkeys(ids))


class DashboardDraftOutput(BaseModel):
    id: str
    title: str
    widgets: list[str]
    note: str


# HarnessTool.check_permission and call must return awaitables.
async def _allow(_: HarnessContext, __: BaseModel) -> PermissionResult:  # NOSONAR
    return PermissionResult.allow("A draft is only shown; the user saves it from the app.")


def dashboard_draft_tool() -> HarnessTool[DashboardDraftInput, DashboardDraftOutput]:
    async def call(  # NOSONAR
        ctx: HarnessContext, value: DashboardDraftInput, progress: Progress
    ) -> DashboardDraftOutput:
        draft_id = f"d{uuid4().hex[:10]}"
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="dashboard.draft",
                message=f"Dashboard draft {value.title}",
                data={
                    "id": draft_id,
                    "title": value.title,
                    "description": value.description,
                    "widgets": value.widgets,
                },
            )
        )
        return DashboardDraftOutput(
            id=draft_id,
            title=value.title,
            widgets=value.widgets,
            note=(
                "The user sees a preview with a button to create the dashboard; nothing is "
                "saved until they press it. Say so in one line. The dashboard keeps the data "
                "as shown now; it does not refresh."
            ),
        )

    return HarnessTool(
        name="dashboard_draft",
        description=(
            "Offer the user a dashboard built from widgets already shown in this thread. "
            "The app shows a preview and creates the dashboard only when the user confirms. "
            f"Up to {MAX_DASHBOARD_WIDGETS} widgets."
        ),
        input_model=DashboardDraftInput,
        output_model=DashboardDraftOutput,
        read_only=False,
        kind="utility",
        source="dashboard_draft",
        check_permission=_allow,
        call=call,
    )
