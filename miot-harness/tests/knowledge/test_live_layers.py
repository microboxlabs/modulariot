"""Knowledge written through the store reaches the next run without a
restart, and a run's knowledge overlay changes only that run."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from langchain_core.messages import SystemMessage

from miot_harness.context_skills.file_source import FileContextSource, FileSkillSource
from miot_harness.context_skills.registry import ContextSkillsBundle
from miot_harness.datasource.knowledge.learned import LearnedFacts, LearnedFactsSource
from miot_harness.knowledge.changes import KnowledgeChange
from miot_harness.knowledge.primer import PrimerSource, PrimerUpdates
from miot_harness.knowledge.store import ConnectionTarget, KnowledgeStore
from miot_harness.knowledge.tenant_overlays import TenantOverlays
from miot_harness.runtime.context import HarnessContext, UserRequest
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.tools.registry import ToolRegistry


class _CapturingLoop:
    def __init__(self) -> None:
        self.prior: list[list[Any]] = []

    async def run(self, *, user_message, ctx, prior_messages, progress):  # type: ignore[no-untyped-def]
        self.prior.append(list(prior_messages))
        return {"answer": "ok", "evidence": [], "usage_log": []}


class _Env:
    def __init__(self, tmp_path: Path) -> None:
        self.context_dir = tmp_path / "context"
        self.skills_dir = tmp_path / "skills"
        conn_dir = tmp_path / "connections" / "db"
        conn_dir.mkdir(parents=True)
        self.conn_md = conn_dir / "connection.md"
        self.conn_md.write_text(
            "---\nname: db\noptions:\n  tenant_lock: t1\n---\n\nBoot primer.\n", encoding="utf-8"
        )
        self.store = KnowledgeStore(
            tenant_id="t1",
            root=tmp_path,
            context_dir=self.context_dir,
            skills_dir=self.skills_dir,
            connections=[ConnectionTarget("db", conn_dir, "t1", cards=True)],
        )
        self.loop = _CapturingLoop()
        self.sup = HarnessSupervisor(
            tools=ToolRegistry(), run_store=JsonRunStore(tmp_path / "runs"), agent_loop=self.loop
        )
        self.sup.context_skills = ContextSkillsBundle(
            overlays=TenantOverlays(self.context_dir, self.skills_dir)
        )
        self.sup.learned_facts = LearnedFacts(
            [LearnedFactsSource("db", conn_dir / "knowledge", "t1")], char_budget=6000
        )
        self.sup.primer_updates = PrimerUpdates(
            [PrimerSource("db", self.conn_md, "t1", "Boot primer.")]
        )

    async def run(self, tenant: str = "t1", **kw: Any) -> str:
        await self.sup.run(UserRequest(message="q", tenant_id=tenant, **kw))
        return "\n".join(
            str(m.content) for m in self.loop.prior[-1] if isinstance(m, SystemMessage)
        )


@pytest.mark.asyncio
async def test_rule_reaches_the_next_run_and_leaves_on_delete(tmp_path: Path) -> None:
    env = _Env(tmp_path)
    assert "Organization rules" not in await env.run()
    env.store.put("rule", "cargado", title="Cargado", content="Means sent to tracking.")
    text = await env.run()
    assert "# Organization rules" in text
    assert "## Cargado\nMeans sent to tracking." in text
    assert "Means sent to tracking." not in await env.run(tenant="t2")
    env.store.delete("rule", "cargado")
    assert "Means sent to tracking." not in await env.run()
    env.store.revert("rule", "cargado", 1)
    assert "Means sent to tracking." in await env.run()


@pytest.mark.asyncio
async def test_unchanged_files_give_identical_blocks(tmp_path: Path) -> None:
    env = _Env(tmp_path)
    env.store.put("rule", "b-rule", title="B", content="Second.")
    env.store.put("rule", "a-rule", title="A", content="First.")
    first = await env.run()
    assert first.index("First.") < first.index("Second.")
    assert await env.run() == first


@pytest.mark.asyncio
async def test_skill_joins_the_tenant_index_and_loads(tmp_path: Path) -> None:
    env = _Env(tmp_path)
    env.store.put("skill", "count-trips", title="Count loaded trips", content="1. Query.")
    text = await env.run()
    assert "- count-trips: Count loaded trips" in text
    bundle = env.sup.context_skills
    assert bundle is not None
    assert bundle.activate_skill("t1", "count-trips") == ("count-trips", "1. Query.")
    assert bundle.activate_skill("t2", "count-trips") is None
    assert [s.id for s in bundle.list_skills("t1")] == ["count-trips"]
    env.store.delete("skill", "count-trips")
    assert bundle.activate_skill("t1", "count-trips") is None
    assert "count-trips" not in await env.run()


def test_boot_sources_skip_learned_dirs(tmp_path: Path) -> None:
    env = _Env(tmp_path)
    env.store.put("rule", "cargado", title="Cargado", content="Rule.")
    env.store.put("skill", "count-trips", title="Count", content="Steps.")
    assert FileContextSource(env.context_dir).load().contexts == ()
    assert FileSkillSource(env.skills_dir).load().skills == ()


@pytest.mark.asyncio
async def test_primer_edit_reaches_the_next_run(tmp_path: Path) -> None:
    env = _Env(tmp_path)
    assert "Updated data source descriptions" not in await env.run()
    env.store.put("primer", "db", content="Edited primer.")
    text = await env.run()
    assert "# Updated data source descriptions" in text
    assert "## db\nEdited primer." in text
    assert "Edited primer." not in await env.run(tenant="t2")
    env.store.revert("primer", "db", 1)
    assert "Updated data source descriptions" not in await env.run()


@pytest.mark.asyncio
async def test_fact_reaches_the_next_run(tmp_path: Path) -> None:
    env = _Env(tmp_path)
    env.store.put("fact", "loaded", target="db", title="Loaded", content="Rows in active_trips.")
    assert "Rows in active_trips." in await env.run()


_OVERLAY = [
    KnowledgeChange(layer="rule", id="draft-rule", title="Draft", content="Overlay rule."),
    KnowledgeChange(layer="skill", id="draft-skill", title="Draft skill", content="Steps."),
    KnowledgeChange(layer="fact", id="draft", target="db", title="F", content="Overlay fact."),
    KnowledgeChange(layer="primer", id="db", content="Overlay primer."),
    KnowledgeChange(layer="eval", id="ignored", title="Q", content="Not a run layer."),
]


@pytest.mark.asyncio
async def test_trainer_overlay_applies_to_that_run_only(tmp_path: Path) -> None:
    env = _Env(tmp_path)
    env.store.put("rule", "kept", title="Kept", content="Stored rule.")
    env.store.put("rule", "gone", title="Gone", content="Deleted by the overlay.")
    overlay = [*_OVERLAY, KnowledgeChange(layer="rule", id="gone", op="delete")]
    text = await env.run(trainer=True, knowledge_overlay=overlay)
    for expected in (
        "Overlay rule.",
        "draft-skill: Draft skill",
        "Overlay fact.",
        "Overlay primer.",
        "Stored rule.",
    ):
        assert expected in text
    assert "Deleted by the overlay." not in text

    after = await env.run(trainer=True)
    assert "Overlay rule." not in after
    assert "Deleted by the overlay." in after
    assert not (env.context_dir / "tenants" / "t1" / "learned" / "draft-rule.md").exists()


@pytest.mark.asyncio
async def test_overlay_from_a_plain_request_is_ignored(tmp_path: Path) -> None:
    env = _Env(tmp_path)
    text = await env.run(knowledge_overlay=_OVERLAY)
    assert "Overlay rule." not in text
    assert "Overlay fact." not in text


def test_code_can_allow_an_overlay_but_a_body_cannot() -> None:
    body = {"message": "q", "tenant_id": "t1", "knowledge_overlay": [_OVERLAY[0].model_dump()]}
    plain = UserRequest.model_validate({**body, "_overlay_allowed": True}).to_context()
    assert plain.knowledge_overlay == ()
    allowed = UserRequest.model_validate(body).allow_overlay().to_context()
    assert [c.id for c in allowed.knowledge_overlay] == ["draft-rule"]
    evaluation = UserRequest.model_validate(
        {**body, "knowledge_overlay": [c.model_dump() for c in _OVERLAY]}
    ).allow_overlay()
    ctx: HarnessContext = evaluation.to_context()
    assert "eval" not in {c.layer for c in ctx.knowledge_overlay}
