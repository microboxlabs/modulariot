"""The per-run "Learned facts" block built from authored connection cards."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from langchain_core.messages import SystemMessage

from miot_harness.datasource.knowledge.learned import LearnedFacts, LearnedFactsSource
from miot_harness.datasource.knowledge.writer import (
    ConnectionCardWrite,
    delete_connection_card,
    write_connection_card,
)
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.tools.registry import ToolRegistry


def _write(cards_dir: Path, term: str, body: str, **kw: Any) -> None:
    write_connection_card(cards_dir, ConnectionCardWrite(term=term, body=body, **kw))


def test_renders_full_bodies_with_precedence_note(tmp_path: Path) -> None:
    _write(tmp_path, "current process", "Only process version v2 is current.")
    block = LearnedFacts([LearnedFactsSource("db", tmp_path)], char_budget=6000).render("t1")
    assert block is not None
    assert block.startswith("# Learned facts")
    assert "trainers" in block
    assert "precedence" in block
    assert "## db" in block
    assert "Only process version v2 is current." in block


def test_no_cards_renders_nothing(tmp_path: Path) -> None:
    facts = LearnedFacts([LearnedFactsSource("db", tmp_path / "knowledge")], char_budget=6000)
    assert facts.render("t1") is None


def test_staged_cards_are_left_out(tmp_path: Path) -> None:
    _write(tmp_path, "draft", "Not approved yet.", status="staged")
    assert LearnedFacts([LearnedFactsSource("db", tmp_path)], char_budget=6000).render("t1") is None


def test_tenant_lock_hides_other_tenants_cards(tmp_path: Path) -> None:
    shared, locked = tmp_path / "shared", tmp_path / "locked"
    _write(shared, "shared term", "Shared definition.")
    _write(locked, "locked term", "Locked definition.")
    facts = LearnedFacts(
        [
            LearnedFactsSource("shared", shared),
            LearnedFactsSource("locked", locked, tenant_lock="t1"),
        ],
        char_budget=6000,
    )
    own = facts.render("t1") or ""
    assert "Locked definition." in own
    assert "Shared definition." in own
    other = facts.render("t2") or ""
    assert "Locked definition." not in other
    assert "Shared definition." in other


def test_budget_falls_back_to_titles_with_tool_pointer(tmp_path: Path) -> None:
    _write(tmp_path, "alpha", "A" * 50)
    _write(tmp_path, "beta", "B" * 50)
    _write(tmp_path, "gamma", "C" * 50)
    block = LearnedFacts([LearnedFactsSource("db", tmp_path)], char_budget=90).render("t1")
    assert block is not None
    assert "A" * 50 in block
    assert "B" * 50 not in block
    assert "C" * 50 not in block
    assert "open with `db_knowledge`" in block
    assert "- beta: beta" in block
    assert "- gamma: gamma" in block


def test_cards_past_the_budget_are_counted_not_listed(tmp_path: Path) -> None:
    _write(tmp_path, "alpha", "A" * 50)
    _write(tmp_path, "beta", "B" * 50)
    block = LearnedFacts([LearnedFactsSource("db", tmp_path)], char_budget=0).render("t1")
    assert block is not None
    assert "A" * 50 not in block
    assert "- alpha" not in block
    assert "2 more not listed; call `db_knowledge`" in block


def test_group_scoped_cards_are_left_out(tmp_path: Path) -> None:
    _write(tmp_path, "team term", "Only for one group.", scope="group:ops")
    assert LearnedFacts([LearnedFactsSource("db", tmp_path)], char_budget=6000).render("t1") is None


def test_new_and_deleted_cards_show_on_next_render(tmp_path: Path) -> None:
    facts = LearnedFacts([LearnedFactsSource("db", tmp_path)], char_budget=6000)
    _write(tmp_path, "first", "First fact.")
    first = facts.render("t1")
    assert first == facts.render("t1")  # stable while nothing changes

    _write(tmp_path, "second", "Second fact.")
    assert "Second fact." in (facts.render("t1") or "")

    assert delete_connection_card(tmp_path, "second")
    assert facts.render("t1") == first


class _CapturingLoop:
    def __init__(self) -> None:
        self.prior: list[list[Any]] = []

    async def run(self, *, user_message, ctx, prior_messages, progress):  # type: ignore[no-untyped-def]
        self.prior.append(list(prior_messages))
        return {"answer": "ok", "evidence": [], "usage_log": []}


def _learned_blocks(messages: list[Any]) -> list[str]:
    return [
        str(m.content)
        for m in messages
        if isinstance(m, SystemMessage) and str(m.content).startswith("# Learned facts")
    ]


@pytest.mark.asyncio
async def test_card_written_after_boot_reaches_the_next_run(tmp_path: Path) -> None:
    cards_dir = tmp_path / "conn" / "knowledge"
    loop = _CapturingLoop()
    sup = HarnessSupervisor(
        tools=ToolRegistry(), run_store=JsonRunStore(tmp_path / "runs"), agent_loop=loop
    )
    sup.learned_facts = LearnedFacts([LearnedFactsSource("db", cards_dir)], char_budget=6000)

    await sup.run(UserRequest(message="q1", tenant_id="t1"))
    assert _learned_blocks(loop.prior[0]) == []

    _write(cards_dir, "current process", "Only process version v2 is current.")
    await sup.run(UserRequest(message="q2", tenant_id="t1"))
    blocks = _learned_blocks(loop.prior[1])
    assert len(blocks) == 1
    assert "Only process version v2 is current." in blocks[0]
