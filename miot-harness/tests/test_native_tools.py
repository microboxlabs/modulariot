import json

from pydantic import BaseModel

from miot_harness.agents.native_tools import build_native_tools
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool
from miot_harness.tools.registry import ToolRegistry
from tests.fixtures.fake_provider import FAKE_PROFILE


class _In(BaseModel):
    limit: int = 10


class _Out(BaseModel):
    rows: list[dict] = []


def _tool(name: str, kind: str) -> HarnessTool:
    async def _allow(ctx, parsed):
        return PermissionResult.allow("test")

    async def _call(ctx, parsed, progress):
        return _Out()

    return HarnessTool(
        name=name,
        description=f"{name} description",
        input_model=_In,
        output_model=_Out,
        kind=kind,
        check_permission=_allow,
        call=_call,
    )


def _registry() -> ToolRegistry:
    reg = ToolRegistry.__new__(ToolRegistry)  # skip built-in tool auto-registration
    reg._tools = {}
    for name, kind in [
        ("fake_kpi_summary", "curated"),
        ("fake_alpha_query", "curated"),
        ("pg_explore", "primitive"),
        ("create_story_draft", "general"),  # must be excluded
    ]:
        reg.register(_tool(name, kind))
    return reg


def test_native_tools_scope_and_order():
    tools = build_native_tools(_registry(), profile=FAKE_PROFILE)
    names = [t["name"] for t in tools]
    assert names == ["fake_alpha_query", "fake_kpi_summary", "pg_explore"]
    assert all(set(t) == {"name", "description", "input_schema"} for t in tools)


def test_native_tools_schema_comes_from_input_model():
    tools = build_native_tools(_registry(), profile=FAKE_PROFILE)
    schema = tools[0]["input_schema"]
    assert schema["properties"]["limit"]["default"] == 10


def test_native_tools_byte_stable():
    a = json.dumps(build_native_tools(_registry(), profile=FAKE_PROFILE), sort_keys=True)
    b = json.dumps(build_native_tools(_registry(), profile=FAKE_PROFILE), sort_keys=True)
    assert a == b
