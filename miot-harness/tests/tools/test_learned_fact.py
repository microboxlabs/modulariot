"""`propose_learned_fact`: a trainer's approved fact becomes a card the next run reads."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import pytest
import yaml
from langchain_core.messages import AIMessage, SystemMessage

from miot_harness.agents.native_tools import build_native_tools
from miot_harness.config import HarnessSettings
from miot_harness.datasource.knowledge.learned import LearnedFacts, LearnedFactsSource
from miot_harness.datasource.knowledge.loader import load_connection_cards
from miot_harness.runtime.agent_loop import AgentLoopRunners
from miot_harness.runtime.approvals import ApprovalRegistry
from miot_harness.runtime.context import HarnessContext, UserRequest
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import (
    PermissionDecision,
    PermissionMode,
    PermissionPolicy,
    PermissionRule,
)
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.tools.learned_fact import PROPOSE_LEARNED_FACT_TOOL, propose_learned_fact_tool
from miot_harness.tools.registry import ToolRegistry
from tests.fixtures.fake_provider import FAKE_PROFILE
from tests.runtime.test_agent_loop import ScriptedModel

_FACT = {
    "connection": "db",
    "term": "current dispatch process",
    "title": "Only v152 of the dispatch process is current",
    "kind": "gotcha",
    "body": "Only version **v152** of the dispatch process is current. Ignore older versions.",
}


def _sources(cards_dir: Path, lock: str | None = None) -> list[LearnedFactsSource]:
    return [LearnedFactsSource("db", cards_dir, lock)]


def _learned(cards_dir: Path, lock: str | None = None) -> LearnedFacts:
    return LearnedFacts(_sources(cards_dir, lock), char_budget=6000)


def _ctx(**kw: Any) -> HarnessContext:
    base: dict[str, Any] = {
        "thread_id": "t",
        "tenant_id": "acme",
        "user_id": "trainer-1",
        "trainer": True,
        "conversation_id": "conv-1",
    }
    return HarnessContext(**{**base, **kw})


class _Approver(ApprovalRegistry):
    """Resolves each approval as soon as it is requested."""

    def __init__(self, decision: str, comment: str | None = None) -> None:
        super().__init__()
        self._decision = decision
        self._comment = comment

    def register(self, approval_id: str, run_id: str) -> asyncio.Event:
        event = super().register(approval_id, run_id)
        asyncio.get_running_loop().call_soon(
            lambda: self.resolve(
                approval_id,
                self._decision,  # type: ignore[arg-type]
                run_id,
                comment=self._comment,
                resolved_by="trainer-1",
            )
        )
        return event


async def _invoke(tool: Any, ctx: HarnessContext, args: dict[str, Any]) -> tuple[Any, list[str]]:
    events: list[HarnessEvent] = []
    out = await tool.invoke(ctx, args, events.append)
    return out, [e.type for e in events]


@pytest.mark.asyncio
async def test_approved_fact_is_written_with_provenance(tmp_path: Path) -> None:
    tool = propose_learned_fact_tool(lambda: _learned(tmp_path))
    ctx = _ctx(approval_registry=_Approver("approve"))

    out, types = await _invoke(tool, ctx, _FACT)

    assert types[:2] == ["approval.requested", "approval.resolved"]
    assert out.status == "saved"
    assert out.card_id == "current-dispatch-process"
    text = (tmp_path / "current-dispatch-process.md").read_text(encoding="utf-8")
    front = yaml.safe_load(text.split("---")[1])
    assert front["scope"] == "tenant"
    assert front["status"] == "approved"
    assert front["kind"] == "gotcha"
    assert front["approved_by"] == "trainer-1"
    assert front["provenance"] == {
        "source": "chat",
        "run_id": ctx.run_id,
        "conversation_id": "conv-1",
        "user": "trainer-1",
    }


@pytest.mark.asyncio
async def test_same_term_again_updates_the_card(tmp_path: Path) -> None:
    tool = propose_learned_fact_tool(lambda: _learned(tmp_path))
    ctx = _ctx(approval_registry=_Approver("approve"))
    await _invoke(tool, ctx, _FACT)

    out, _ = await _invoke(tool, ctx, {**_FACT, "body": "Only version v153 is current."})

    assert out.status == "updated"
    cards = load_connection_cards(tmp_path).cards
    assert [c.body for c in cards] == ["Only version v153 is current."]


@pytest.mark.asyncio
async def test_declined_fact_tells_the_agent_to_ask(tmp_path: Path) -> None:
    tool = propose_learned_fact_tool(lambda: _learned(tmp_path))
    ctx = _ctx(approval_registry=_Approver("deny", comment="say v152 and later"))

    with pytest.raises(PermissionError) as err:
        await _invoke(tool, ctx, _FACT)

    assert "trainer declined" in str(err.value)
    assert "say v152 and later" in str(err.value)
    assert not list(tmp_path.glob("*.md"))


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", [PermissionMode.BYPASS, PermissionMode.AUTO_SAFE])
async def test_auto_approve_modes_still_ask(tmp_path: Path, mode: PermissionMode) -> None:
    tool = propose_learned_fact_tool(lambda: _learned(tmp_path))
    policy = PermissionPolicy(
        mode=mode,
        rules=[PermissionRule(tool=PROPOSE_LEARNED_FACT_TOOL, decision=PermissionDecision.ALLOW)],
    )
    ctx = _ctx(permission_policy=policy, approval_registry=_Approver("approve"))

    _, types = await _invoke(tool, ctx, _FACT)

    assert "approval.auto" not in types
    assert "approval.requested" in types


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("ctx_kw", "args", "reason"),
    [
        ({"trainer": False}, _FACT, "only a trainer"),
        ({}, {**_FACT, "connection": "other"}, "does not take learned facts"),
        ({"tenant_id": "someone-else"}, _FACT, "does not take learned facts"),
        ({}, {**_FACT, "body": "Escalate to ops.lead@example.com"}, "email"),
        ({}, {**_FACT, "body": "The driver is 12.345.678-9"}, "numeric"),
    ],
)
async def test_refused_before_asking(
    tmp_path: Path, ctx_kw: dict[str, Any], args: dict[str, Any], reason: str
) -> None:
    tool = propose_learned_fact_tool(lambda: _learned(tmp_path, lock="acme"))
    events: list[HarnessEvent] = []
    ctx = _ctx(approval_registry=ApprovalRegistry(), **ctx_kw)

    with pytest.raises(PermissionError) as err:
        await tool.invoke(ctx, args, events.append)

    assert reason in str(err.value)
    assert "approval.requested" not in [e.type for e in events]


def test_offered_only_to_trainers_with_a_knowledge_folder(tmp_path: Path) -> None:
    registry = ToolRegistry.__new__(ToolRegistry)
    registry._tools = {}
    sources: list[LearnedFactsSource] = []
    registry.register(propose_learned_fact_tool(lambda: LearnedFacts(sources, char_budget=6000)))

    def offered(trainer: bool) -> bool:
        names = [
            t["name"] for t in build_native_tools(registry, profile=FAKE_PROFILE, trainer=trainer)
        ]
        return PROPOSE_LEARNED_FACT_TOOL in names

    assert not offered(trainer=True)
    sources.extend(_sources(tmp_path))
    assert offered(trainer=True)
    assert not offered(trainer=False)


def _learned_block(messages: list[Any]) -> str:
    for m in messages:
        text = m.content if isinstance(m.content, str) else str(m.content)
        if "# Learned facts" in text:
            return text
    return ""


@pytest.mark.asyncio
async def test_approved_in_chat_then_used_by_the_next_run(tmp_path: Path) -> None:
    """A trainer's run proposes a fact, the trainer approves it, and the next
    run's Learned facts block carries it."""
    cards_dir = tmp_path / "db" / "knowledge"
    models = [
        ScriptedModel(
            [
                AIMessage(
                    content="",
                    tool_calls=[{"name": PROPOSE_LEARNED_FACT_TOOL, "args": _FACT, "id": "c1"}],
                ),
                AIMessage(content="Saved. Only v152 is current."),
            ]
        ),
        ScriptedModel([AIMessage(content="v152 works like this.")]),
    ]
    registry = ToolRegistry.__new__(ToolRegistry)
    registry._tools = {}
    sup = HarnessSupervisor(
        tools=registry,
        run_store=JsonRunStore(tmp_path / "runs"),
        approval_registry=_Approver("approve"),
    )
    sup.learned_facts = LearnedFacts(_sources(cards_dir), char_budget=6000)
    registry.register(propose_learned_fact_tool(lambda: sup.learned_facts))
    built = iter(models)
    sup.agent_loop = AgentLoopRunners(
        default_model="claude-opus-4-8",
        models=["claude-opus-4-8"],
        build_model=lambda name, effort=None: next(built),
        registry=registry,
        settings=HarnessSettings(agents_agent_loop_max_turns=3),
        profile=FAKE_PROFILE,
    )

    first = await sup.run(
        UserRequest(
            message="Only v152 of the dispatch process is current.",
            tenant_id="acme",
            user_id="trainer-1",
            conversation_id="conv-1",
            trainer=True,
        )
    )
    assert first.status == "completed"
    assert first.answer.startswith("Saved.")
    trainer_tools = [t["name"] for t in models[0].bound_tools or []]
    assert PROPOSE_LEARNED_FACT_TOOL in trainer_tools
    assert "# Teaching mode" in str(models[0].calls[0])

    await sup.run(
        UserRequest(message="How does dispatch work?", tenant_id="acme", user_id="analyst-1")
    )
    assert PROPOSE_LEARNED_FACT_TOOL not in [t["name"] for t in models[1].bound_tools or []]
    block = _learned_block(models[1].calls[0])
    assert "Only v152 of the dispatch process is current" in block
    assert "Ignore older versions." in block
    assert "# Teaching mode" not in str(models[1].calls[0])


def test_teaching_guidance_lists_usable_connections(tmp_path: Path) -> None:
    facts = LearnedFacts(
        [
            LearnedFactsSource("db", tmp_path / "a"),
            LearnedFactsSource("locked", tmp_path / "b", tenant_lock="other"),
        ],
        char_budget=6000,
    )
    guidance = facts.trainer_guidance("acme") or ""
    assert "`db`" in guidance
    assert "locked" not in guidance
    assert "propose_learned_fact" in guidance
    assert LearnedFacts([], char_budget=10).trainer_guidance("acme") is None


def test_trainer_block_is_a_system_message(tmp_path: Path) -> None:
    sup = HarnessSupervisor(tools=ToolRegistry(), run_store=JsonRunStore(tmp_path / "runs"))
    sup.learned_facts = LearnedFacts(_sources(tmp_path), char_budget=6000)
    plain = sup._inject_learned_facts(_ctx(trainer=False), [])
    taught = sup._inject_learned_facts(_ctx(), [])
    assert plain == []
    assert len(taught) == 1
    assert isinstance(taught[0], SystemMessage)


@pytest.mark.asyncio
async def test_an_ask_rule_still_runs_the_personal_data_check(tmp_path: Path) -> None:
    tool = propose_learned_fact_tool(lambda: _learned(tmp_path))
    policy = PermissionPolicy(
        rules=[PermissionRule(tool=PROPOSE_LEARNED_FACT_TOOL, decision=PermissionDecision.ASK)],
    )
    events: list[HarnessEvent] = []
    ctx = _ctx(permission_policy=policy, approval_registry=_Approver("approve"))
    args = {**_FACT, "title": "Escalate to ops.lead@example.com"}

    with pytest.raises(PermissionError) as err:
        await tool.invoke(ctx, args, events.append)

    assert "email" in str(err.value)
    assert "approval.requested" not in [e.type for e in events]
    assert not list(tmp_path.glob("*.md"))


@pytest.mark.asyncio
async def test_context_report_counts_the_trainer_tools(tmp_path: Path) -> None:
    registry = ToolRegistry.__new__(ToolRegistry)
    registry._tools = {}
    sup = HarnessSupervisor(tools=registry, run_store=JsonRunStore(tmp_path / "runs"))
    sup.learned_facts = LearnedFacts(_sources(tmp_path / "k"), char_budget=6000)
    registry.register(propose_learned_fact_tool(lambda: sup.learned_facts))
    sup.agent_loop = AgentLoopRunners(
        default_model="claude-opus-4-8",
        models=["claude-opus-4-8"],
        build_model=lambda name, effort=None: ScriptedModel([]),
        registry=registry,
        settings=HarnessSettings(),
        profile=FAKE_PROFILE,
    )

    async def tools_tokens(trainer: bool) -> int:
        record = await sup.run(UserRequest(message="/context", tenant_id="acme", trainer=trainer))
        return int(record.artifacts[-1]["tools"])

    assert await tools_tokens(True) > await tools_tokens(False)
