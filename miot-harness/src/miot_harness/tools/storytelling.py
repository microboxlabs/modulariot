from pydantic import BaseModel

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool, Progress


class StoryDraftInput(BaseModel):
    title: str
    summary: str


class StoryDraftOutput(BaseModel):
    title: str
    summary: str
    artifact_type: str = "story"


async def _permission(_: HarnessContext, __: StoryDraftInput) -> PermissionResult:
    return PermissionResult.allow("Story drafts are non-mutating artifacts.")


async def _call(_: HarnessContext, value: StoryDraftInput, __: Progress) -> StoryDraftOutput:
    return StoryDraftOutput(title=value.title, summary=value.summary)


def create_story_draft_tool() -> HarnessTool[StoryDraftInput, StoryDraftOutput]:
    return HarnessTool(
        name="create_story_draft",
        description="Create a structured MIOT Storytelling artifact draft.",
        input_model=StoryDraftInput,
        output_model=StoryDraftOutput,
        read_only=True,
        check_permission=_permission,
        call=_call,
    )
