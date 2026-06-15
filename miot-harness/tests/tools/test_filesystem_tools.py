from __future__ import annotations

import pytest

from miot_harness.config import HarnessSettings
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.tools.filesystem import (
    FsReadOutput,
    FsWriteOutput,
    VirtualFileStore,
    build_filesystem_tools,
)
from miot_harness.tools.registry import build_default_registry


def _ctx(*, conversation_id: str | None = "conv-1", thread_id: str = "thread-1") -> HarnessContext:
    return HarnessContext(
        thread_id=thread_id,
        tenant_id="acme",
        user_id="u1",
        conversation_id=conversation_id,
    )


def _tools() -> dict[str, object]:
    store = VirtualFileStore()
    return {t.name: t for t in build_filesystem_tools(store)}


@pytest.mark.asyncio
async def test_write_then_read_through_tools() -> None:
    tools = _tools()
    ctx = _ctx()
    events: list[HarnessEvent] = []

    out = await tools["fs_write"].invoke(ctx, {"path": "n.md", "content": "hi"}, events.append)
    assert isinstance(out, FsWriteOutput)
    assert out.ok and out.created and out.bytes == 2

    read = await tools["fs_read"].invoke(ctx, {"path": "n.md"}, events.append)
    assert isinstance(read, FsReadOutput)
    assert read.found and read.content == "hi"


@pytest.mark.asyncio
async def test_invoke_emits_started_and_completed_events() -> None:
    tools = _tools()
    events: list[HarnessEvent] = []
    await tools["fs_write"].invoke(_ctx(), {"path": "n.md", "content": "x"}, events.append)
    types = [e.type for e in events]
    assert "tool.started" in types
    assert "tool.completed" in types


@pytest.mark.asyncio
async def test_read_missing_returns_found_false_no_raise() -> None:
    tools = _tools()
    out = await tools["fs_read"].invoke(_ctx(), {"path": "ghost.md"}, lambda _e: None)
    assert isinstance(out, FsReadOutput)
    assert out.ok and out.found is False and out.content is None


@pytest.mark.asyncio
async def test_cap_violation_returns_typed_error_not_exception() -> None:
    store = VirtualFileStore(max_file_bytes=2)
    tools = {t.name: t for t in build_filesystem_tools(store)}
    out = await tools["fs_write"].invoke(
        _ctx(), {"path": "n.md", "content": "toolong"}, lambda _e: None
    )
    assert isinstance(out, FsWriteOutput)
    assert out.ok is False
    assert out.error is not None and out.error.startswith("file_too_large")


@pytest.mark.asyncio
async def test_tools_isolate_by_conversation() -> None:
    # One shared store across both contexts (as in production), different
    # conversation ids → isolated views.
    store = VirtualFileStore()
    tools = {t.name: t for t in build_filesystem_tools(store)}
    a, b = _ctx(conversation_id="A"), _ctx(conversation_id="B")

    await tools["fs_write"].invoke(a, {"path": "f.md", "content": "secret-a"}, lambda _e: None)
    out_b = await tools["fs_read"].invoke(b, {"path": "f.md"}, lambda _e: None)
    assert isinstance(out_b, FsReadOutput)
    assert out_b.found is False


@pytest.mark.asyncio
async def test_edit_through_tool() -> None:
    tools = _tools()
    ctx = _ctx()
    await tools["fs_write"].invoke(ctx, {"path": "f.md", "content": "alpha beta"}, lambda _e: None)
    out = await tools["fs_edit"].invoke(
        ctx, {"path": "f.md", "old_string": "beta", "new_string": "gamma"}, lambda _e: None
    )
    assert out.ok and out.replacements == 1
    read = await tools["fs_read"].invoke(ctx, {"path": "f.md"}, lambda _e: None)
    assert read.content == "alpha gamma"


@pytest.mark.asyncio
async def test_round_trip_through_registry_invoke() -> None:
    # T4: prove the normal tool-invocation seam (used by data_fetcher in
    # both data_graph and agentic_graph) reaches the scratchpad.
    registry = build_default_registry()
    ctx = _ctx()
    await registry.invoke(
        "fs_write", ctx, {"path": "plan.md", "content": "step 1"}, lambda _e: None
    )
    out = await registry.invoke("fs_read", ctx, {"path": "plan.md"}, lambda _e: None)
    assert isinstance(out, FsReadOutput)
    assert out.found and out.content == "step 1"


def test_default_registry_excludes_fs_tools_when_disabled() -> None:
    registry = build_default_registry(HarnessSettings(fs_enabled=False))
    assert not any(n.startswith("fs_") for n in registry.names())
