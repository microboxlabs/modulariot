from collections.abc import Awaitable, Callable
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import PermissionResult

InputT = TypeVar("InputT", bound=BaseModel)
OutputT = TypeVar("OutputT", bound=BaseModel)
Progress = Callable[[HarnessEvent], None]


class HarnessTool(BaseModel, Generic[InputT, OutputT]):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    name: str
    description: str
    input_model: type[InputT]
    output_model: type[OutputT]
    read_only: bool = True
    destructive: bool = False
    check_permission: Callable[[HarnessContext, InputT], Awaitable[PermissionResult]]
    call: Callable[[HarnessContext, InputT, Progress], Awaitable[OutputT]]

    async def invoke(
        self,
        ctx: HarnessContext,
        raw_input: dict[str, Any],
        progress: Progress,
    ) -> OutputT:
        parsed_input = self.input_model.model_validate(raw_input)
        permission = await self.check_permission(ctx, parsed_input)
        if permission.decision == "deny":
            raise PermissionError(permission.reason)
        if permission.decision == "ask":
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="approval.requested",
                    message=permission.reason,
                    data={"tool": self.name, "input": parsed_input.model_dump()},
                )
            )
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="tool.started",
                message=f"Starting {self.name}",
                data={"tool": self.name},
            )
        )
        output = await self.call(ctx, parsed_input, progress)
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="tool.completed",
                message=f"Completed {self.name}",
                data={"tool": self.name, **_lift_metadata(output)},
            )
        )
        return self.output_model.model_validate(output)


_METADATA_KEYS = ("source", "refreshed_at", "layer", "domain", "truncated")


def _lift_metadata(output: Any) -> dict[str, Any]:
    """Surface a fixed set of metadata fields from the tool output into the
    tool.completed event payload. Tools that do not expose these fields get
    a bare event; tools that do (e.g. Nexo coordinador_*) carry the
    structured trace metadata downstream consumers (analyst, run record)
    rely on.
    """
    if not hasattr(output, "model_dump"):
        return {}
    try:
        dump = output.model_dump()
    except Exception:
        return {}
    return {key: dump[key] for key in _METADATA_KEYS if key in dump}
