"""`artifact`: show the user a diagram, note or small page the model wrote.

The content goes to the user's screen in an `artifact.created` event; the
model gets back the id to place it in the answer. SVG is limited to shapes
and text; HTML is shown in a sandboxed frame by the app.
"""

from __future__ import annotations

from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool, Progress
from miot_harness.utils import svg as svg_check

MAX_ARTIFACT_BYTES = 400_000

ArtifactKind = Literal["svg", "mermaid", "markdown", "html"]

SVG_TAGS = frozenset(
    {"svg", "g", "defs", "marker", "path", "rect", "circle", "ellipse", "line",
     "polyline", "polygon", "text", "tspan", "title", "desc", "linearGradient",
     "radialGradient", "stop", "clipPath", "mask", "pattern"}
)  # fmt: skip


class ArtifactInput(BaseModel):
    kind: ArtifactKind = Field(
        description=(
            "svg: a diagram (shapes and text only, no scripts, links or images); "
            "mermaid: a Mermaid diagram source; markdown: a written note or report; "
            "html: a small self-contained page (no network access)"
        )
    )
    title: str = Field(min_length=1, max_length=200, description="Short title, user's language")
    content: str = Field(min_length=1, description="The full source")


class ArtifactOutput(BaseModel):
    id: str
    kind: ArtifactKind
    title: str
    bytes: int
    note: str


# HarnessTool.check_permission and call must return awaitables.
async def _allow(_: HarnessContext, __: BaseModel) -> PermissionResult:  # NOSONAR
    return PermissionResult.allow("Artifacts are shown to the user; nothing is stored.")


def validate_artifact(kind: ArtifactKind, content: str) -> int:
    """The content's size in bytes, or ValueError when it cannot be shown."""
    size = len(content.encode())
    if size > MAX_ARTIFACT_BYTES:
        raise ValueError(f"content is {size} bytes; the limit is {MAX_ARTIFACT_BYTES}")
    if kind == "svg":
        svg_check.check_svg(content, tags=SVG_TAGS)
    return size


def artifact_tool() -> HarnessTool[ArtifactInput, ArtifactOutput]:
    async def call(  # NOSONAR
        ctx: HarnessContext, value: ArtifactInput, progress: Progress
    ) -> ArtifactOutput:
        size = validate_artifact(value.kind, value.content)
        artifact_id = f"a{uuid4().hex[:10]}"
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="artifact.created",
                message=f"Artifact {value.title}",
                data={
                    "id": artifact_id,
                    "kind": value.kind,
                    "title": value.title,
                    "content": value.content,
                    "source": "artifact",
                },
            )
        )
        return ArtifactOutput(
            id=artifact_id,
            kind=value.kind,
            title=value.title,
            bytes=size,
            note=(
                "The user sees it. Place it with an artifact block and this id; "
                "do not repeat its content in the answer."
            ),
        )

    return HarnessTool(
        name="artifact",
        description=(
            "Show the user a result they can keep: a diagram (svg or mermaid), a "
            "written note or report (markdown) or a small page (html). Use it for "
            "flows, structures and long deliverables, not for charts of query "
            f"results (use `<connection>_show`). Content up to {MAX_ARTIFACT_BYTES // 1000} KB."
        ),
        input_model=ArtifactInput,
        output_model=ArtifactOutput,
        read_only=False,
        kind="utility",
        source="artifact",
        check_permission=_allow,
        call=call,
    )
