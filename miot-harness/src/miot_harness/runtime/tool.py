import json
from collections.abc import Awaitable, Callable
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.utils.truncation import truncate_for_trace

InputT = TypeVar("InputT", bound=BaseModel)
OutputT = TypeVar("OutputT", bound=BaseModel)
Progress = Callable[[HarnessEvent], None]

# Cap for serialized tool output emitted in debug-mode events.
# 2 KB matches Anthropic's tool_result soft limit and keeps SSE
# frames small enough that proxies don't buffer them.
_DEBUG_OUTPUT_BYTES_CAP = 2048


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
        input_dump = parsed_input.model_dump()
        input_keys = sorted(input_dump.keys())
        permission = await self.check_permission(ctx, parsed_input)
        if permission.decision == "deny":
            raise PermissionError(permission.reason)
        if permission.decision == "ask":
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="approval.requested",
                    message=permission.reason,
                    data={"tool": self.name, "input": input_dump},
                )
            )
        started_data: dict[str, Any] = {"tool": self.name, "input_keys": input_keys}
        if ctx.debug:
            started_data.update(_debug_input_payload(input_dump))
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="tool.started",
                message=f"Starting {self.name}",
                data=started_data,
            )
        )
        output = await self.call(ctx, parsed_input, progress)
        completed_data: dict[str, Any] = {
            "tool": self.name,
            "result_shape": _compute_result_shape(output),
            **_lift_metadata(output),
        }
        if ctx.debug:
            completed_data.update(_debug_output_payload(output))
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="tool.completed",
                message=f"Completed {self.name}",
                data=completed_data,
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


def _dump_payload(output: Any) -> Any:
    if hasattr(output, "model_dump"):
        try:
            return output.model_dump()
        except Exception:
            return output
    return output


def _compute_result_shape(output: Any) -> dict[str, Any]:
    """Lightweight, schema-free hint about the tool result so CLI clients
    can render `tool ok: foo → list[42]` without seeing the payload itself.
    """
    payload = _dump_payload(output)
    if isinstance(payload, list):
        return {"type": "list", "length": len(payload)}
    if isinstance(payload, dict):
        if isinstance(payload.get("rows"), list):
            return {"type": "rows", "length": len(payload["rows"])}
        return {"type": "dict", "length": len(payload)}
    if payload is None:
        return {"type": "none", "length": 0}
    return {"type": type(payload).__name__, "length": 1}


def _debug_output_payload(output: Any) -> dict[str, Any]:
    """Return `{output, truncated}` for debug-mode events.

    Two-stage cap: first run `truncate_for_trace` to keep the structural
    shape (rows trimmed, big dicts narrowed). Then bound the serialized
    JSON at `_DEBUG_OUTPUT_BYTES_CAP` so we never blow the SSE frame.
    """
    payload = _dump_payload(output)
    capped, info = truncate_for_trace(payload)
    truncated = bool(info.get("truncated", False))
    try:
        serialized = json.dumps(capped, default=str)
    except Exception:
        return {"output": None, "truncated": True}
    encoded = serialized.encode("utf-8")
    if len(encoded) > _DEBUG_OUTPUT_BYTES_CAP:
        # Slice on the byte buffer (not the str) so multibyte UTF-8
        # characters can't push the wire payload past the cap.
        # errors="ignore" drops any incomplete codepoint at the cut
        # boundary so the decoded string is always valid UTF-8.
        return {
            "output": encoded[:_DEBUG_OUTPUT_BYTES_CAP].decode(
                "utf-8", errors="ignore"
            ),
            "truncated": True,
        }
    return {"output": capped, "truncated": truncated}


def _debug_input_payload(input_dump: dict[str, Any]) -> dict[str, Any]:
    """Return `{input, truncated}` for debug-mode tool.started events.

    Same two-stage cap as `_debug_output_payload` so a pathological
    arg (a 10 MB string, a huge list) can't blow the SSE frame and
    the SSE consumer always sees a deterministically-sized payload.
    """
    capped, info = truncate_for_trace(input_dump)
    truncated = bool(info.get("truncated", False))
    try:
        serialized = json.dumps(capped, default=str)
    except Exception:
        return {"input": None, "truncated": True}
    encoded = serialized.encode("utf-8")
    if len(encoded) > _DEBUG_OUTPUT_BYTES_CAP:
        # See _debug_output_payload — byte-slice + lossy decode so
        # multibyte characters can't blow past the SSE frame cap.
        return {
            "input": encoded[:_DEBUG_OUTPUT_BYTES_CAP].decode(
                "utf-8", errors="ignore"
            ),
            "truncated": True,
        }
    return {"input": capped, "truncated": truncated}
