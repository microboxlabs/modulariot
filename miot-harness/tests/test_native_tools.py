import json
from typing import Any

from pydantic import BaseModel, Field

from miot_harness.agents.native_tools import build_native_tools, compact_schema
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
        ("write_todos", "general"),  # must be excluded
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


class _Optional(BaseModel):
    title: str | None = Field(default=None, description="a field named title")
    when: str | None = None
    mode: str = "list"


def test_compact_schema_drops_titles_and_null_branches_but_keeps_fields():
    schema = compact_schema(_Optional.model_json_schema())
    assert schema == {
        "properties": {
            "title": {"type": "string", "description": "a field named title"},
            "when": {"type": "string"},
            "mode": {"default": "list", "type": "string"},
        },
        "type": "object",
    }
    # The input model still validates, explicit null included.
    assert _Optional.model_validate({"when": None}).when is None


class _Kept(BaseModel):
    value: str | None
    options: dict[str, Any] = Field(default={"title": "report", "default": None})


def test_compact_schema_keeps_required_nulls_and_default_values():
    schema = compact_schema(_Kept.model_json_schema())
    assert schema["required"] == ["value"]
    assert schema["properties"]["value"] == {"anyOf": [{"type": "string"}, {"type": "null"}]}
    assert schema["properties"]["options"]["default"] == {"title": "report", "default": None}


def test_generic_tool_schemas_shrink_by_a_sixth(tmp_path):
    from miot_harness.datasource.sql_policy import SchemaAllowlistPolicy
    from miot_harness.integrations.generic_pg.primitive_tools import build_generic_tools

    tools = build_generic_tools(
        pool=None,
        policy=SchemaAllowlistPolicy(frozenset({"s"})),
        tool_prefix="fake_",
        source_label="fake",
        tenant_lock=None,
        max_rows=100,
        explain_cost_threshold=100_000,
        statement_timeout_ms=1_000,
        workspace_dir=tmp_path,
        workflow_schema="s",
    )
    registry = ToolRegistry.__new__(ToolRegistry)
    registry._tools = {}
    for tool in tools:
        registry.register(tool)
    native = build_native_tools(registry, profile=FAKE_PROFILE)
    raw = sum(len(json.dumps(t.input_model.model_json_schema())) for t in tools)
    compacted = sum(len(json.dumps(t["input_schema"])) for t in native)
    assert len(native) == len(tools)
    assert compacted <= raw * 5 // 6
