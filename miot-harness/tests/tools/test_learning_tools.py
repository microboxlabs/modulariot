"""Trainer tools: knowledge and workspace file changes, approved from a diff."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import pytest
from langchain_core.messages import AIMessage

from miot_harness.agents.native_tools import build_native_tools
from miot_harness.config import HarnessSettings
from miot_harness.datasource.knowledge.learned import LearnedFacts, LearnedFactsSource
from miot_harness.knowledge.store import ConnectionTarget, KnowledgeStore
from miot_harness.runtime.agent_loop import AgentLoopRunners
from miot_harness.runtime.approvals import ApprovalRegistry
from miot_harness.runtime.context import HarnessContext, UserRequest
from miot_harness.runtime.event_payload import PREVIEW_BYTES_CAP
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import PermissionMode, PermissionPolicy
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.tools.filesystem import VirtualFileStore, fs_edit_tool, fs_write_tool
from miot_harness.tools.knowledge_tools import (
    knowledge_list_tool,
    knowledge_read_tool,
    propose_knowledge_change_tool,
)
from miot_harness.tools.registry import ToolRegistry
from miot_harness.tools.workspace_files import (
    ws_delete_tool,
    ws_edit_tool,
    ws_grep_tool,
    ws_ls_tool,
    ws_read_tool,
    ws_write_tool,
)
from tests.fixtures.fake_provider import FAKE_PROFILE
from tests.runtime.test_agent_loop import ScriptedModel

TRAINER_TOOLS = (
    "knowledge_list",
    "knowledge_read",
    "propose_knowledge_change",
    "ws_ls",
    "ws_read",
    "ws_grep",
    "ws_write",
    "ws_edit",
    "ws_delete",
)

_FACT = """---
id: trip-status
term: trip status
title: Trip status values
kind: term
scope: tenant
status: approved
---

ADDED means the trip was added to the plan.
"""


class _Approver(ApprovalRegistry):
    """Resolves each approval as soon as it is requested."""

    def __init__(self, decision: str = "approve") -> None:
        super().__init__()
        self._decision = decision

    def register(self, approval_id: str, run_id: str) -> asyncio.Event:
        event = super().register(approval_id, run_id)
        asyncio.get_running_loop().call_soon(
            lambda: self.resolve(
                approval_id,
                self._decision,  # type: ignore[arg-type]
                run_id,
                resolved_by="trainer-1",
            )
        )
        return event


def _workspace(tmp_path: Path) -> Path:
    conn = tmp_path / "connections" / "db"
    (conn / "knowledge").mkdir(parents=True)
    (conn / "knowledge" / "trip-status.md").write_text(_FACT, encoding="utf-8")
    (tmp_path / "context").mkdir()
    (tmp_path / "skills" / "reports").mkdir(parents=True)
    (tmp_path / "skills" / "reports" / "SKILL.md").write_text(
        "---\nname: reports\ndescription: Shipped reports.\n---\n\nStep one.\n", encoding="utf-8"
    )
    return conn


def _store_for(tmp_path: Path):  # type: ignore[no-untyped-def]
    conn = tmp_path / "connections" / "db"

    def store_for(tenant: str) -> KnowledgeStore:
        return KnowledgeStore(
            tenant_id=tenant,
            root=tmp_path,
            context_dir=tmp_path / "context",
            skills_dir=tmp_path / "skills",
            connections=[ConnectionTarget("db", conn, None, cards=True)],
        )

    return store_for


def _registry(tmp_path: Path) -> ToolRegistry:
    registry = ToolRegistry()
    store_for = _store_for(tmp_path)
    for factory in (
        knowledge_list_tool,
        knowledge_read_tool,
        propose_knowledge_change_tool,
        ws_ls_tool,
        ws_read_tool,
        ws_grep_tool,
        ws_write_tool,
        ws_edit_tool,
        ws_delete_tool,
    ):
        registry.register(factory(store_for))
    return registry


def _ctx(**kw: Any) -> HarnessContext:
    base: dict[str, Any] = {
        "thread_id": "t",
        "tenant_id": "acme",
        "user_id": "trainer-1",
        "trainer": True,
        "conversation_id": "conv-1",
        "approval_registry": _Approver(),
    }
    return HarnessContext(**{**base, **kw})


async def _invoke(
    registry: ToolRegistry, name: str, args: dict[str, Any], ctx: HarnessContext | None = None
) -> tuple[Any, list[HarnessEvent]]:
    events: list[HarnessEvent] = []
    out = await registry.invoke(name, ctx or _ctx(), args, events.append)
    return out, events


def _event(events: list[HarnessEvent], kind: str) -> dict[str, Any]:
    return next(e.data for e in events if e.type == kind)


@pytest.mark.asyncio
async def test_ws_edit_is_approved_from_its_diff_and_writes_a_version(tmp_path: Path) -> None:
    _workspace(tmp_path)
    registry = _registry(tmp_path)
    args = {
        "path": "facts/db/trip-status.md",
        "old_string": "ADDED means the trip was added to the plan.",
        "new_string": "ADDED means added to the plan; SCHEDULED means running as planned.",
        "reason": "taught in chat",
    }

    out, events = await _invoke(registry, "ws_edit", args)

    shown = _event(events, "approval.requested")["input"]
    assert shown["path"] == "facts/db/trip-status.md"
    assert (shown["layer"], shown["op"], shown["target"]) == ("fact", "edit", "db")
    assert "-ADDED means the trip was added to the plan." in shown["diff"]
    assert "+ADDED means added to the plan; SCHEDULED means running as planned." in shown["diff"]
    assert shown["old_lines"] == shown["new_lines"]
    assert out.version == 2
    assert out.diff == shown["diff"]
    item = _store_for(tmp_path)("acme").read("fact", "trip-status", "db")
    assert "SCHEDULED means running as planned" in item["content"]
    assert item["history"][0]["reason"] == "taught in chat"
    assert _event(events, "tool.completed")["preview"]["diff"] == out.diff


@pytest.mark.asyncio
async def test_a_long_diff_reaches_the_app_whole(tmp_path: Path) -> None:
    _workspace(tmp_path)
    registry = _registry(tmp_path)
    body = "\n".join(
        f"Line {n}: a rule about trips that is long enough to add up." for n in range(200)
    )
    content = f"---\ntitle: Trip glossary\n---\n\n{body}\n"

    out, events = await _invoke(
        registry, "ws_write", {"path": "rules/trips.md", "content": content}
    )

    assert len(out.diff.encode()) > 5 * PREVIEW_BYTES_CAP
    requested = _event(events, "approval.requested")
    assert requested["input"]["diff"] == out.diff
    assert "input_truncated" not in requested
    completed = _event(events, "tool.completed")
    assert completed["preview"]["diff"] == out.diff
    assert "preview_truncated" not in completed
    assert (tmp_path / "context" / "tenants" / "acme" / "learned" / "trips.md").is_file()


@pytest.mark.asyncio
async def test_edit_failures_are_refused_before_asking(tmp_path: Path) -> None:
    _workspace(tmp_path)
    (tmp_path / "context" / "tenants" / "acme" / "learned").mkdir(parents=True)
    (tmp_path / "context" / "tenants" / "acme" / "learned" / "a.md").write_text(
        "---\ntitle: A\n---\n\nsame same\n", encoding="utf-8"
    )
    registry = _registry(tmp_path)
    cases = [
        ({"path": "rules/a.md", "old_string": "missing", "new_string": "x"}, "not in the file"),
        ({"path": "rules/a.md", "old_string": "same", "new_string": "x"}, "occurs 2 times"),
        (
            {"path": "base/skills/reports/SKILL.md", "old_string": "one", "new_string": "two"},
            "read-only",
        ),
        ({"path": "../etc/passwd", "old_string": "a", "new_string": "b"}, "no such path"),
        (
            {"path": "rules/a.md", "old_string": "same same", "new_string": "mail ops@example.com"},
            "email",
        ),
    ]
    for args, reason in cases:
        events: list[HarnessEvent] = []
        with pytest.raises(PermissionError) as err:
            await registry.invoke("ws_edit", _ctx(), args, events.append)
        assert reason in str(err.value)
        assert "approval.requested" not in [e.type for e in events]

    out, _ = await _invoke(
        registry,
        "ws_edit",
        {"path": "rules/a.md", "old_string": "same", "new_string": "other", "replace_all": True},
    )
    assert "+other other" in out.diff


@pytest.mark.asyncio
async def test_auto_approve_modes_still_ask(tmp_path: Path) -> None:
    _workspace(tmp_path)
    registry = _registry(tmp_path)
    ctx = _ctx(permission_policy=PermissionPolicy(mode=PermissionMode.BYPASS))

    _, events = await _invoke(
        registry, "ws_write", {"path": "rules/b.md", "content": "---\ntitle: B\n---\n\nB.\n"}, ctx
    )

    types = [e.type for e in events]
    assert "approval.auto" not in types
    assert "approval.requested" in types


@pytest.mark.asyncio
async def test_declined_write_changes_nothing(tmp_path: Path) -> None:
    _workspace(tmp_path)
    registry = _registry(tmp_path)
    ctx = _ctx(approval_registry=_Approver("deny"))

    with pytest.raises(PermissionError) as err:
        await _invoke(registry, "ws_delete", {"path": "facts/db/trip-status.md"}, ctx)

    assert "trainer declined" in str(err.value)
    assert (tmp_path / "connections" / "db" / "knowledge" / "trip-status.md").is_file()


@pytest.mark.asyncio
async def test_read_tools_see_the_virtual_tree(tmp_path: Path) -> None:
    _workspace(tmp_path)
    registry = _registry(tmp_path)

    listed, _ = await _invoke(registry, "ws_ls", {"path": ""})
    paths = {f.path: f.writable for f in listed.files}
    assert paths == {"facts/db/trip-status.md": True, "base/skills/reports/SKILL.md": False}

    read, _ = await _invoke(
        registry, "ws_read", {"path": "base/skills/reports/SKILL.md", "offset": 2, "limit": 2}
    )
    assert read.content == "     2\tname: reports\n     3\tdescription: Shipped reports."
    assert (read.total_lines, read.lines, read.writable) == (6, 2, False)

    found, _ = await _invoke(registry, "ws_grep", {"pattern": "added", "ignore_case": True})
    assert [(m.path, m.line) for m in found.matches] == [("facts/db/trip-status.md", 10)]

    layers, _ = await _invoke(registry, "knowledge_list", {"layer": "fact"})
    assert layers.layers[0]["items"][0]["path"] == "facts/db/trip-status.md"
    item, _ = await _invoke(
        registry, "knowledge_read", {"layer": "fact", "id": "trip-status", "target": "db"}
    )
    assert item.path == "facts/db/trip-status.md"


@pytest.mark.asyncio
async def test_propose_knowledge_change_applies_a_batch_with_diffs(tmp_path: Path) -> None:
    _workspace(tmp_path)
    registry = _registry(tmp_path)
    args = {
        "summary": "Trip status glossary",
        "changes": [
            {
                "layer": "rule",
                "id": "loaded-trips",
                "op": "upsert",
                "title": "Loaded trips",
                "content": "A loaded trip is one the coordinator sent to monitoring.",
                "reason": "trainer",
            },
            {
                "layer": "eval",
                "id": "loaded-today",
                "op": "upsert",
                "title": "How many trips were loaded today?",
                "content": "Counts today's monitored trips.",
            },
            {"layer": "fact", "id": "trip-status", "target": "db", "op": "delete"},
        ],
    }

    out, events = await _invoke(registry, "propose_knowledge_change", args)

    shown = _event(events, "approval.requested")["input"]["changes"]
    assert [c["path"] for c in shown] == [
        "rules/loaded-trips.md",
        "evals/loaded-today.yaml",
        "facts/db/trip-status.md",
    ]
    assert all(c["diff"] for c in shown)
    assert [c.op for c in out.changes] == ["upsert", "upsert", "delete"]
    assert [c.version for c in out.changes] == [1, 1, None]
    assert out.changes[2].new_lines == 0
    preview = _event(events, "tool.completed")["preview"]
    assert [c["diff"] for c in preview["changes"]] == [c.diff for c in out.changes]
    store = _store_for(tmp_path)("acme")
    history = store.read("rule", "loaded-trips")
    assert history["updated_by"] == "trainer-1"
    assert not (tmp_path / "connections" / "db" / "knowledge" / "trip-status.md").exists()


@pytest.mark.asyncio
async def test_non_trainers_get_no_tools_and_cannot_call_them(tmp_path: Path) -> None:
    _workspace(tmp_path)
    registry = _registry(tmp_path)

    def offered(trainer: bool) -> set[str]:
        return {
            t["name"] for t in build_native_tools(registry, profile=FAKE_PROFILE, trainer=trainer)
        }

    assert offered(trainer=True) >= set(TRAINER_TOOLS)
    assert not offered(trainer=False) & set(TRAINER_TOOLS)
    with pytest.raises(PermissionError, match="only a trainer"):
        await _invoke(registry, "ws_read", {"path": "facts/db/trip-status.md"}, _ctx(trainer=False))


@pytest.mark.asyncio
async def test_scratchpad_writes_return_a_diff() -> None:
    store = VirtualFileStore()
    ctx = _ctx()
    write, edit = fs_write_tool(store), fs_edit_tool(store)

    created = await write.invoke(ctx, {"path": "plan.md", "content": "one\ntwo\n"}, lambda _: None)
    changed = await edit.invoke(
        ctx, {"path": "plan.md", "old_string": "two", "new_string": "three"}, lambda _: None
    )

    assert "+one" in (created.diff or "") and "--- /dev/null" in (created.diff or "")
    assert "-two\n+three\n" in (changed.diff or "")


def _supervisor(
    tmp_path: Path, registry: ToolRegistry, models: list[ScriptedModel]
) -> HarnessSupervisor:
    sup = HarnessSupervisor(
        tools=registry, run_store=JsonRunStore(tmp_path / "runs"), approval_registry=_Approver()
    )
    sup.learned_facts = LearnedFacts(
        [LearnedFactsSource("db", tmp_path / "connections" / "db" / "knowledge")], char_budget=6000
    )
    sup.knowledge_store_for = _store_for(tmp_path)
    built = iter(models)
    sup.agent_loop = AgentLoopRunners(
        default_model="claude-opus-4-8",
        models=["claude-opus-4-8"],
        build_model=lambda name, effort=None: next(built),
        registry=registry,
        settings=HarnessSettings(agents_agent_loop_max_turns=3),
        profile=FAKE_PROFILE,
    )
    return sup


@pytest.mark.asyncio
async def test_an_approved_edit_is_seen_by_the_next_run_and_by_diff(tmp_path: Path) -> None:
    _workspace(tmp_path)
    registry = _registry(tmp_path)
    edit = {
        "path": "facts/db/trip-status.md",
        "old_string": "ADDED means the trip was added to the plan.",
        "new_string": "SCHEDULED means the trip runs as planned.",
    }
    models = [
        ScriptedModel(
            [
                AIMessage(content="", tool_calls=[{"name": "ws_edit", "args": edit, "id": "c1"}]),
                AIMessage(content="Saved."),
            ]
        ),
        ScriptedModel([AIMessage(content="Scheduled trips run as planned.")]),
    ]
    sup = _supervisor(tmp_path, registry, models)

    first = await sup.run(
        UserRequest(
            message="/fact SCHEDULED means the trip runs as planned",
            tenant_id="acme",
            user_id="trainer-1",
            conversation_id="conv-1",
            trainer=True,
        )
    )
    assert first.status == "completed"
    assert "[Learning session command /fact]" in str(models[0].calls[0])
    assert "# Teaching mode" in str(models[0].calls[0])

    await sup.run(UserRequest(message="What does SCHEDULED mean?", tenant_id="acme", user_id="u2"))
    seen = str(models[1].calls[0])
    assert "SCHEDULED means the trip runs as planned." in seen
    assert "ADDED means the trip was added" not in seen
    assert "# Teaching mode" not in seen
    assert not {t["name"] for t in models[1].bound_tools or []} & set(TRAINER_TOOLS)

    diff = await sup.run(
        UserRequest(message="/diff", tenant_id="acme", conversation_id="conv-1", trainer=True)
    )
    assert "1 file changed in this conversation." in (diff.answer or "")
    assert "+SCHEDULED means the trip runs as planned." in (diff.answer or "")
    other = await sup.run(
        UserRequest(message="/diff", tenant_id="acme", conversation_id="conv-2", trainer=True)
    )
    assert other.answer == "No knowledge was changed in this conversation yet."
