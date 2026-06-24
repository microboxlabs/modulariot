"""The resolved bundle held on the supervisor.

Loaded once at boot, it answers three per-request questions keyed on the
requesting tenant:

- `primer_for(tenant)` -> a global block (stable across tenants, so its
  Anthropic cache prefix stays hot) + a separate tenant overlay block;
- `facts_for(tenant)` -> meta-catalog rows (global ∪ tenant, tenant wins
  on name collision);
- `playbooks_for(tenant)` -> playbook skills (global ∪ tenant, tenant
  wins on id collision).

Layering rule everywhere: take global items, then let a tenant-scoped
item with the same key replace its global twin for that tenant; items
scoped to a *different* tenant are filtered out.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from miot_harness.agents.meta_agent import MetaAgentCatalogEntry
from miot_harness.context_skills.models import SystemContext
from miot_harness.context_skills.skill_models import (
    LoadedSkill,
    PlaybookSkill,
    SkillSummary,
)


@dataclass(frozen=True)
class ResolvedPrimer:
    """The two primer blocks kept separable for prompt-cache safety."""

    global_block: str
    tenant_block: str  # "" when the requesting tenant has no overlay


def _is_for_tenant(scope_kind: str, scope_tenant: str | None, tenant_id: str) -> bool:
    """True if a global item, or a tenant item matching `tenant_id`."""
    if scope_kind == "global":
        return True
    return scope_tenant == tenant_id


class ContextSkillsBundle:
    def __init__(
        self,
        contexts: tuple[SystemContext, ...] = (),
        playbook_skills: tuple[LoadedSkill, ...] = (),
    ) -> None:
        self.contexts = contexts
        self.playbook_skills = playbook_skills

    # ---- primer -----------------------------------------------------------

    def global_primer(self) -> str:
        """The global primer block — identical for every tenant.

        Composed at boot into the datasource primer so the global system
        context reaches every agent path while staying cache-stable.
        """
        return self._join_primer(
            c.primer_text
            for c in self._by_priority(self.contexts)
            if c.scope.kind == "global" and c.primer_text
        )

    def primer_for(self, tenant_id: str) -> ResolvedPrimer:
        tenant_block = self._join_primer(
            c.primer_text
            for c in self._by_priority(self.contexts)
            if c.scope.kind == "tenant"
            and c.scope.tenant_id == tenant_id
            and c.primer_text
        )
        return ResolvedPrimer(global_block=self.global_primer(), tenant_block=tenant_block)

    # ---- facts (meta catalog) --------------------------------------------

    def facts_for(self, tenant_id: str) -> list[MetaAgentCatalogEntry]:
        """Global ∪ tenant facts as meta-catalog rows; tenant overrides
        global on fact name. Plus a compact 'available skills' index so
        'what can you do?' is answered from the playbook set."""
        chosen: dict[str, MetaAgentCatalogEntry] = {}
        chosen_tenant: dict[str, bool] = {}
        for ctx in self._by_priority(self.contexts):
            if not _is_for_tenant(ctx.scope.kind, ctx.scope.tenant_id, tenant_id):
                continue
            tenant_scoped = ctx.scope.kind == "tenant"
            for fact in ctx.facts:
                # Only block a global from overriding an entry a tenant doc
                # already set. Otherwise the later (higher-priority, or
                # tenant) entry wins via dict assignment — so a
                # higher-priority global still replaces a lower-priority one.
                if chosen_tenant.get(fact.name) and not tenant_scoped:
                    continue
                chosen[fact.name] = MetaAgentCatalogEntry(
                    name=fact.name,
                    layer=fact.layer,
                    title=fact.title or fact.name,
                    body=fact.body,
                )
                chosen_tenant[fact.name] = tenant_scoped
        rows = list(chosen.values())
        rows.extend(self._skill_index_rows(tenant_id))
        return rows

    def _skill_index_rows(self, tenant_id: str) -> list[MetaAgentCatalogEntry]:
        rows: list[MetaAgentCatalogEntry] = []
        for loaded in self.playbooks_for(tenant_id):
            skill = loaded.skill
            assert isinstance(skill, PlaybookSkill)  # playbooks_for guarantees
            rows.append(
                MetaAgentCatalogEntry(
                    name=f"skill:{skill.id}",
                    layer="skill",
                    title=skill.name,
                    body=(skill.when_to_use or skill.description or skill.name),
                )
            )
        return rows

    # ---- playbooks --------------------------------------------------------

    def playbooks_for(self, tenant_id: str) -> list[LoadedSkill]:
        chosen: dict[str, LoadedSkill] = {}
        chosen_tenant: dict[str, bool] = {}
        for loaded in self._by_priority_skills(self.playbook_skills):
            skill = loaded.skill
            if not isinstance(skill, PlaybookSkill):
                continue
            if not _is_for_tenant(skill.scope.kind, skill.scope.tenant_id, tenant_id):
                continue
            tenant_scoped = skill.scope.kind == "tenant"
            # Same rule as facts_for: a global never overrides a tenant
            # entry, but higher-priority same-scope items still win.
            if chosen_tenant.get(skill.id) and not tenant_scoped:
                continue
            chosen[skill.id] = loaded
            chosen_tenant[skill.id] = tenant_scoped
        return list(chosen.values())

    # ---- skill listing (autocomplete / picker) ----------------------------

    def list_skills(self, tenant_id: str) -> list[SkillSummary]:
        """Compact skill summaries for the requesting tenant — the data
        behind a `/skills` listing / autocomplete.

        Same set and layering as `playbooks_for` (Agent-Skills `SKILL.md`
        directory skills included, since they load as playbooks), projected
        to `SkillSummary` and sorted by name for a stable picker. `source`
        is derived from the load path so the UI can badge a `SKILL.md`
        directory skill distinctly from a YAML manifest.
        """
        summaries: list[SkillSummary] = []
        for loaded in self.playbooks_for(tenant_id):
            skill = loaded.skill
            assert isinstance(skill, PlaybookSkill)  # playbooks_for guarantees
            summaries.append(
                SkillSummary(
                    id=skill.id,
                    name=skill.name,
                    description=skill.description,
                    when_to_use=skill.when_to_use,
                    scope=skill.scope.kind,
                    source=(
                        "skill_md"
                        if loaded.source_path.lower().endswith("skill.md")
                        else "manifest"
                    ),
                )
            )
        return sorted(summaries, key=lambda s: s.name.lower())

    def activate_skill(
        self, tenant_id: str, skill_id: str
    ) -> tuple[str, str] | None:
        """Resolve a skill the tenant can see to ``(name, body)`` for
        injection into a run, or ``None`` when unknown or bodyless.

        This is the invocation half of skills: `list_skills` discovers
        them, `activate_skill` hands back the SKILL.md body so the
        supervisor can inject it as run guidance.
        """
        for loaded in self.playbooks_for(tenant_id):
            skill = loaded.skill
            assert isinstance(skill, PlaybookSkill)  # playbooks_for guarantees
            if skill.id == skill_id and loaded.playbook_body:
                return skill.name, loaded.playbook_body
        return None

    # ---- helpers ----------------------------------------------------------

    @staticmethod
    def _join_primer(blocks: Iterable[str]) -> str:
        return "\n\n".join(blocks).strip()

    @staticmethod
    def _by_priority(contexts: tuple[SystemContext, ...]) -> list[SystemContext]:
        # Stable sort by priority ascending so higher-priority docs are
        # visited last and win the dict-assignment / override races above.
        return sorted(contexts, key=lambda c: c.priority)

    @staticmethod
    def _by_priority_skills(skills: tuple[LoadedSkill, ...]) -> list[LoadedSkill]:
        def _prio(loaded: LoadedSkill) -> int:
            skill = loaded.skill
            return getattr(skill, "priority", 0)

        return sorted(skills, key=_prio)
