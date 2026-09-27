"""Scratchpad and task list: offered to the loop, kept apart per tenant."""

from __future__ import annotations

import json

import pytest
from langchain_core.messages import AIMessage, ToolMessage

from miot_harness.agents.native_tools import build_native_tools
from miot_harness.config import HarnessSettings
from miot_harness.runtime.agent_loop import AgentLoopRunner
from miot_harness.runtime.context import HarnessContext, UserRequest
from miot_harness.tools.filesystem import VirtualFileStore, build_filesystem_tools
from miot_harness.tools.registry import build_default_registry
from miot_harness.tools.todos import TodoStore, write_todos_tool
from tests.fixtures.fake_provider import FAKE_PROFILE
from tests.runtime.test_agent_loop import ScriptedModel


def _ctx(tenant: str, conversation: str = "same-id") -> HarnessContext:
    return HarnessContext(
        thread_id="t", tenant_id=tenant, user_id="u1", conversation_id=conversation
    )


@pytest.mark.asyncio
async def test_two_tenants_naming_the_same_conversation_get_separate_scratchpads() -> None:
    tools = {t.name: t for t in build_filesystem_tools(VirtualFileStore())}
    await tools["fs_write"].invoke(
        _ctx("acme"), {"path": "notes.md", "content": "acme secret"}, lambda _e: None
    )
    other = await tools["fs_read"].invoke(_ctx("globex"), {"path": "notes.md"}, lambda _e: None)
    assert other.found is False
    own = await tools["fs_read"].invoke(_ctx("acme"), {"path": "notes.md"}, lambda _e: None)
    assert own.content == "acme secret"


@pytest.mark.asyncio
async def test_write_todos_keeps_the_latest_list_and_counts_it() -> None:
    store = TodoStore()
    tool = write_todos_tool(store)
    out = await tool.invoke(
        _ctx("acme"),
        {
            "todos": [
                {"content": "count trips", "status": "completed"},
                {"content": "compare to last week", "status": "in_progress"},
                {"content": "chart it"},
            ]
        },
        lambda _e: None,
    )
    assert (out.pending, out.in_progress, out.completed) == (1, 1, 1)
    assert [t.content for t in store.get("acme/u1/same-id")] == [
        "count trips",
        "compare to last week",
        "chart it",
    ]
    assert store.get("globex/u1/same-id") == []


def test_the_loop_is_offered_the_utility_tools() -> None:
    names = {t["name"] for t in build_native_tools(build_default_registry(), profile=FAKE_PROFILE)}
    assert {"fs_write", "fs_read", "fs_ls", "fs_edit", "write_todos"} <= names
    assert "create_story_draft" not in names


@pytest.mark.asyncio
async def test_a_utility_result_goes_back_to_the_model_without_evidence() -> None:
    model = ScriptedModel(
        [
            AIMessage(
                content="",
                tool_calls=[
                    {
                        "name": "write_todos",
                        "args": {"todos": [{"content": "step one", "status": "in_progress"}]},
                        "id": "w1",
                    }
                ],
            ),
            AIMessage(content="done"),
        ]
    )
    runner = AgentLoopRunner(
        model=model,
        registry=build_default_registry(),
        settings=HarnessSettings(agents_agent_loop_max_turns=3),
        profile=FAKE_PROFILE,
        provenance_log=None,
    )
    result = await runner.run(
        user_message="plan it",
        ctx=UserRequest(message="plan it", tenant_id="acme").to_context(),
        prior_messages=[],
        progress=lambda _e: None,
    )
    assert result["evidence"] == []
    tool_result = next(m for m in model.calls[-1] if isinstance(m, ToolMessage))
    payload = tool_result.content if isinstance(tool_result.content, str) else ""
    if not payload:
        payload = tool_result.content[0]["text"]  # type: ignore[index]
    assert json.loads(payload)["in_progress"] == 1
