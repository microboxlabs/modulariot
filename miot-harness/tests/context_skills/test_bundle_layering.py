from __future__ import annotations

from miot_harness.context_skills.models import ContextScope, SystemContext, SystemFact
from miot_harness.context_skills.registry import ContextSkillsBundle
from miot_harness.context_skills.skill_models import LoadedSkill, PlaybookSkill


def _ctx(
    id: str, kind: str, tenant: str | None, primer: str, facts: tuple[SystemFact, ...]
) -> SystemContext:
    return SystemContext(
        id=id,
        scope=ContextScope(kind=kind, tenant_id=tenant),  # type: ignore[arg-type]
        primer_text=primer,
        facts=facts,
    )


def _playbook(id: str, kind: str, tenant: str | None) -> LoadedSkill:
    return LoadedSkill(
        skill=PlaybookSkill(
            kind="playbook",
            id=id,
            name=id,
            scope=ContextScope(kind=kind, tenant_id=tenant),  # type: ignore[arg-type]
        )
    )


def test_facts_tenant_overrides_global() -> None:
    bundle = ContextSkillsBundle(
        contexts=(
            _ctx("g", "global", None, "G", (SystemFact(name="shared", body="global"),)),
            _ctx(
                "t",
                "tenant",
                "mintral",
                "T",
                (SystemFact(name="shared", body="tenant"),),
            ),
        )
    )
    mintral = {e.name: e.body for e in bundle.facts_for("mintral")}
    acme = {e.name: e.body for e in bundle.facts_for("acme")}
    assert mintral["shared"] == "tenant"
    assert acme["shared"] == "global"


def test_primer_blocks_split_and_cache_invariant() -> None:
    bundle = ContextSkillsBundle(
        contexts=(
            _ctx("g", "global", None, "GLOBAL", ()),
            _ctx("t", "tenant", "mintral", "TENANT-ONLY", ()),
        )
    )
    mintral = bundle.primer_for("mintral")
    acme = bundle.primer_for("acme")
    assert mintral.global_block == "GLOBAL"
    assert mintral.tenant_block == "TENANT-ONLY"
    assert acme.tenant_block == ""
    # The global block must be byte-identical across tenants so the
    # Anthropic cache prefix stays hot.
    assert mintral.global_block == acme.global_block


def test_playbooks_filter_by_tenant() -> None:
    bundle = ContextSkillsBundle(
        playbook_skills=(
            _playbook("global-pb", "global", None),
            _playbook("mintral-pb", "tenant", "mintral"),
        )
    )
    mintral_ids = {s.skill.id for s in bundle.playbooks_for("mintral")}
    acme_ids = {s.skill.id for s in bundle.playbooks_for("acme")}
    assert mintral_ids == {"global-pb", "mintral-pb"}
    assert acme_ids == {"global-pb"}


def test_skill_index_appended_to_facts() -> None:
    bundle = ContextSkillsBundle(
        playbook_skills=(_playbook("pb1", "global", None),)
    )
    names = {e.name for e in bundle.facts_for("acme")}
    assert "skill:pb1" in names
