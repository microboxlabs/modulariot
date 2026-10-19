"""Tenant rules and skills that trainers write, read live on every run.

    <context_dir>/tenants/<T>/learned/<id>.md        rule (frontmatter title)
    <skills_dir>/tenants/<T>/learned/<id>/SKILL.md   skill (name, description)

The boot-time file sources skip these directories, so an edit never has to
wait for a restart and a deleted item never lingers. Parsed files are cached
per directory until a file is added, removed or changed, and items come back
sorted by id, so unchanged files give byte-identical prompt text.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from pathlib import Path

import yaml

from miot_harness.context_skills.models import ContextScope
from miot_harness.context_skills.skill_models import LoadedSkill, PlaybookSkill
from miot_harness.knowledge.changes import KnowledgeChange, changes_for
from miot_harness.knowledge.formats import parse_rule, parse_skill, safe_segment

logger = logging.getLogger(__name__)

LEARNED_DIR = "learned"
TENANTS_DIR = "tenants"
SKILL_FILE = "SKILL.md"


def is_learned_path(parts: tuple[str, ...]) -> bool:
    """True for a path (relative to a context or skills dir) inside a tenant's
    learned directory."""
    return len(parts) >= 3 and parts[0] == TENANTS_DIR and parts[2] == LEARNED_DIR


def learned_dir(base: Path, tenant_id: str) -> Path | None:
    tenant = safe_segment(tenant_id)
    return base / TENANTS_DIR / tenant / LEARNED_DIR if tenant else None


@dataclass(frozen=True)
class LearnedItem:
    id: str
    title: str
    content: str
    path: str


_Signature = tuple[tuple[str, int, int], ...]


class _DirCache:
    """Parsed items of one directory glob, re-read when its files change."""

    def __init__(self, pattern: str, parse: Callable[[Path], LearnedItem]) -> None:
        self._pattern = pattern
        self._parse = parse
        self._cache: dict[Path, tuple[_Signature, tuple[LearnedItem, ...]]] = {}

    def items(self, folder: Path) -> tuple[LearnedItem, ...]:
        if not folder.is_dir():
            return ()
        paths = sorted(p for p in folder.glob(self._pattern) if p.is_file())
        try:
            signature = tuple(
                (str(p), st.st_mtime_ns, st.st_size) for p in paths for st in (p.stat(),)
            )
        except OSError:
            return ()
        cached = self._cache.get(folder)
        if cached is not None and cached[0] == signature:
            return cached[1]
        parsed: list[LearnedItem] = []
        for path in paths:
            try:
                parsed.append(self._parse(path))
            except (OSError, ValueError, yaml.YAMLError) as exc:
                logger.warning("learned knowledge: %s: %s", path, exc)
        items = tuple(sorted(parsed, key=lambda i: i.id))
        self._cache[folder] = (signature, items)
        return items


def _parse_rule_file(path: Path) -> LearnedItem:
    title, content, _ = parse_rule(path.read_text(encoding="utf-8"), path.stem)
    return LearnedItem(path.stem, title, content, str(path))


def _parse_skill_file(path: Path) -> LearnedItem:
    title, content, _ = parse_skill(path.read_text(encoding="utf-8"), path.parent.name)
    return LearnedItem(path.parent.name, title, content, str(path))


def apply_changes(
    items: Iterable[LearnedItem], changes: Iterable[KnowledgeChange]
) -> tuple[LearnedItem, ...]:
    """`items` with the overlay changes applied in order, sorted by id."""
    by_id = {i.id: i for i in items}
    for change in changes:
        if change.op == "delete":
            by_id.pop(change.id, None)
        else:
            by_id[change.id] = LearnedItem(
                change.id, change.title.strip() or change.id, change.content.strip(), "<overlay>"
            )
    return tuple(sorted(by_id.values(), key=lambda i: i.id))


class TenantOverlays:
    def __init__(self, context_dir: Path, skills_dir: Path) -> None:
        self.context_dir = Path(context_dir)
        self.skills_dir = Path(skills_dir)
        self._rules = _DirCache("*.md", _parse_rule_file)
        self._skills = _DirCache(f"*/{SKILL_FILE}", _parse_skill_file)

    def rules(
        self, tenant_id: str, overlay: Iterable[KnowledgeChange] = ()
    ) -> tuple[LearnedItem, ...]:
        folder = learned_dir(self.context_dir, tenant_id)
        items = self._rules.items(folder) if folder else ()
        return apply_changes(items, changes_for(overlay, "rule"))

    def skills(
        self, tenant_id: str, overlay: Iterable[KnowledgeChange] = ()
    ) -> tuple[LoadedSkill, ...]:
        folder = learned_dir(self.skills_dir, tenant_id)
        items = self._skills.items(folder) if folder else ()
        scope = ContextScope(kind="tenant", tenant_id=tenant_id)
        return tuple(
            LoadedSkill(
                skill=PlaybookSkill(
                    kind="playbook",
                    id=item.id,
                    name=item.id,
                    description=item.title,
                    when_to_use=item.title,
                    scope=scope,
                ),
                playbook_body=item.content or None,
                source_path=item.path,
            )
            for item in apply_changes(items, changes_for(overlay, "skill"))
        )

    def rules_block(self, tenant_id: str, overlay: Iterable[KnowledgeChange] = ()) -> str:
        """The tenant's rules as one prompt block, or "" when there are none."""
        rules = self.rules(tenant_id, overlay)
        if not rules:
            return ""
        sections = [f"## {r.title}\n{r.content}" for r in rules]
        return "\n\n".join(
            [
                "# Organization rules\nRules and terms your organization's trainers "
                "set. Follow them when they apply.",
                *sections,
            ]
        )

    def skills_block(self, tenant_id: str, overlay: Iterable[KnowledgeChange] = ()) -> str:
        skills = self.skills(tenant_id, overlay)
        if not skills:
            return ""
        lines = [f"- {s.skill.id}: {' '.join(s.skill.description.split())}" for s in skills]
        return (
            "# Organization procedures\nProcedures your organization's trainers wrote. "
            "When a question matches one, call `load_skill` with its id before "
            "planning, then follow it.\n" + "\n".join(lines)
        )
