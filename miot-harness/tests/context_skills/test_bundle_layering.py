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


def test_higher_priority_global_overrides_lower_global() -> None:
    low = SystemContext(
        id="a", priority=0, facts=(SystemFact(name="shared", body="low"),)
    )
    high = SystemContext(
        id="b", priority=5, facts=(SystemFact(name="shared", body="high"),)
    )
    # Pass high first to prove ordering follows priority, not insertion.
    bundle = ContextSkillsBundle(contexts=(high, low))
    facts = {e.name: e.body for e in bundle.facts_for("acme")}
    assert facts["shared"] == "high"


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


def test_list_skills_projects_summaries_source_scope_and_sort() -> None:
    bundle = ContextSkillsBundle(
        playbook_skills=(
            LoadedSkill(
                skill=PlaybookSkill(
                    kind="playbook",
                    id="zeta",
                    name="Zeta",
                    description="z desc",
                    when_to_use="when z",
                ),
                source_path="/x/zeta.yaml",
            ),
            LoadedSkill(
                skill=PlaybookSkill(
                    kind="playbook", id="alpha", name="Alpha", description="a desc"
                ),
                source_path="/x/alpha/SKILL.md",
            ),
            _playbook("mintral-only", "tenant", "mintral"),
        )
    )
    skills = bundle.list_skills("mintral")
    by_id = {s.id: s for s in skills}
    # Global ∪ tenant, same layering as playbooks_for.
    assert {"zeta", "alpha", "mintral-only"} <= set(by_id)
    # source is derived from the load path: SKILL.md vs YAML manifest.
    assert by_id["alpha"].source == "skill_md"
    assert by_id["zeta"].source == "manifest"
    assert by_id["zeta"].when_to_use == "when z"
    # Stable, case-insensitive name sort for a deterministic picker.
    names = [s.name for s in skills]
    assert names == sorted(names, key=str.lower)
    # A different tenant doesn't see the mintral-scoped skill.
    assert "mintral-only" not in {s.id for s in bundle.list_skills("acme")}


def test_list_skills_surfaces_connection_binding_marker() -> None:
    # Phase 4 slice 2: a bound skill's summary carries the connection /
    # capability it lights up for; an unbound skill leaves them None.
    bundle = ContextSkillsBundle(
        playbook_skills=(
            LoadedSkill(
                skill=PlaybookSkill(
                    kind="playbook",
                    id="acs-wf",
                    name="ACS workflow",
                    connection="acs",
                    requires_capability="generic_query",
                ),
                source_path="/x/acs-wf.yaml",
            ),
            LoadedSkill(
                skill=PlaybookSkill(kind="playbook", id="plain", name="Plain"),
                source_path="/x/plain.yaml",
            ),
        )
    )
    by_id = {s.id: s for s in bundle.list_skills("acme")}
    assert by_id["acs-wf"].connection == "acs"
    assert by_id["acs-wf"].requires_capability == "generic_query"
    assert by_id["plain"].connection is None
    assert by_id["plain"].requires_capability is None


def test_activate_skill_returns_name_and_body() -> None:
    bundle = ContextSkillsBundle(
        playbook_skills=(
            LoadedSkill(
                skill=PlaybookSkill(kind="playbook", id="sc", name="Skill Creator"),
                playbook_body="BODY TEXT",
                source_path="/w/sc/SKILL.md",
            ),
            _playbook("nobody", "global", None),  # no playbook_body
        )
    )
    assert bundle.activate_skill("acme", "sc") == ("Skill Creator", "BODY TEXT")
    # Bodyless and unknown skills are not activatable.
    assert bundle.activate_skill("acme", "nobody") is None
    assert bundle.activate_skill("acme", "missing") is None
