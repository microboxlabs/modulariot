"""File-backed Context & Skill sources.

Directory layout (a packaged default dir, or a mounted ConfigMap):

    <context_dir>/
        *.yaml | *.md                 -> global context docs
        tenants/<tenant_id>/*.yaml|md  -> per-tenant overlay docs

    <skills_dir>/
        **/*.yaml                      -> global skill manifests
        **/<name>/SKILL.md             -> global Agent-Skill directory skills
        tenants/<tenant_id>/**/*.yaml  -> per-tenant skill manifests
        tenants/<id>/**/<name>/SKILL.md -> per-tenant Agent-Skill skills

A `SKILL.md` is the open Agent-Skills standard: a YAML frontmatter block
(`name`, `description`, ...) fenced by `---`, followed by a Markdown body.
Each is loaded as a `playbook` skill — the frontmatter `description`
becomes the progressive-disclosure trigger and the body is the on-demand
playbook text — so dropping a skill folder into the volume surfaces it in
the skill index with no manifest to author. Auxiliary files the body
references (scripts/, references/) stay on disk and are read on demand.

The *directory* is authoritative for scope: a doc under
`tenants/<id>/` is tenant-scoped to `<id>`. Any `scope` declared inside
the file itself is ignored (manifests may still declare it for
readability — the directory always wins).

Paths whose components start with a dot are skipped: Kubernetes projects
a ConfigMap/Secret volume with internal `..data` / `..2026_...` symlinks
that would otherwise double-ingest every manifest.

Every file is parsed in isolation: one malformed file becomes a
`LoadDiagnostic` and the rest still load. A missing base dir yields an
empty result plus one warning — the image must boot with no mounted
config.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import TypeAdapter, ValidationError

from miot_harness.context_skills.models import ContextScope, SystemContext
from miot_harness.context_skills.skill_models import (
    LoadedSkill,
    PlaybookSkill,
    Skill,
)
from miot_harness.context_skills.source import (
    ContextLoadResult,
    ContextSource,
    LoadDiagnostic,
    SkillLoadResult,
    SkillSource,
)

_TENANTS_DIR = "tenants"
# The Agent-Skills standard: a directory skill is a folder holding a
# `SKILL.md` (case-insensitive match so `Skill.md` variants still load).
_SKILL_MD_NAME = "skill.md"
_SKILL_ADAPTER: TypeAdapter[Skill] = TypeAdapter(Skill)


def _is_hidden(path: Path, base_dir: Path) -> bool:
    """True if any path component under `base_dir` starts with a dot.

    Excludes Kubernetes projected-volume internals (`..data`,
    `..2026_06_17_...`) and any dotfile, so a mounted ConfigMap doesn't
    double-ingest every manifest through its symlinked snapshot dir.
    """
    try:
        parts = path.relative_to(base_dir).parts
    except ValueError:
        return False
    return any(part.startswith(".") for part in parts)


def _scope_for(path: Path, base_dir: Path) -> ContextScope:
    """Derive a scope from where the file sits under `base_dir`.

    `<base>/tenants/<id>/...` -> tenant(<id>); anything else -> global.
    """
    try:
        parts = path.relative_to(base_dir).parts
    except ValueError:
        return ContextScope(kind="global")
    if len(parts) >= 2 and parts[0] == _TENANTS_DIR:
        return ContextScope(kind="tenant", tenant_id=parts[1])
    return ContextScope(kind="global")


def _load_yaml_mapping(path: Path) -> dict[str, Any]:
    """Parse a YAML file that must be a mapping. Raises on anything else."""
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if data is None:
        return {}
    if not isinstance(data, dict):
        raise ValueError(f"expected a YAML mapping, got {type(data).__name__}")
    return data


def _split_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """Split an Agent-Skills `SKILL.md` into (frontmatter mapping, body).

    Per the standard, frontmatter is a YAML mapping fenced by a leading
    `---` line and the next `---` line; everything after is the Markdown
    body. Raises ValueError if a fence is missing or the block is not a
    mapping (callers turn that into a per-file diagnostic).
    """
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise ValueError("SKILL.md must open with a '---' frontmatter fence")
    closing = next(
        (i for i in range(1, len(lines)) if lines[i].strip() == "---"), None
    )
    if closing is None:
        raise ValueError("SKILL.md frontmatter is missing its closing '---' fence")
    front = yaml.safe_load("\n".join(lines[1:closing])) or {}
    if not isinstance(front, dict):
        raise ValueError(
            f"SKILL.md frontmatter must be a YAML mapping, got {type(front).__name__}"
        )
    body = "\n".join(lines[closing + 1 :]).strip()
    return front, body


class FileContextSource(ContextSource):
    def __init__(self, base_dir: Path) -> None:
        self._base_dir = Path(base_dir)

    def load(self) -> ContextLoadResult:
        base = self._base_dir
        if not base.is_dir():
            return ContextLoadResult(
                diagnostics=(
                    LoadDiagnostic(
                        str(base),
                        "warning",
                        "context dir does not exist; no context loaded",
                    ),
                )
            )
        contexts: list[SystemContext] = []
        diagnostics: list[LoadDiagnostic] = []
        for path in sorted(base.rglob("*")):
            if _is_hidden(path, base):
                continue
            if not path.is_file() or path.suffix.lower() not in {".yaml", ".yml", ".md"}:
                continue
            try:
                ctx = self._parse_one(path, base)
            except (ValueError, ValidationError, yaml.YAMLError, OSError) as exc:
                diagnostics.append(LoadDiagnostic(str(path), "error", str(exc)))
                continue
            contexts.append(ctx)
        return ContextLoadResult(tuple(contexts), tuple(diagnostics))

    def _parse_one(self, path: Path, base: Path) -> SystemContext:
        scope = _scope_for(path, base)
        if path.suffix.lower() == ".md":
            return SystemContext(
                id=path.stem,
                scope=scope,
                primer_text=path.read_text(encoding="utf-8").strip(),
            )
        data = _load_yaml_mapping(path)
        # The directory is authoritative for scope.
        data["scope"] = scope.model_dump()
        data.setdefault("id", path.stem)
        return SystemContext.model_validate(data)


class FileSkillSource(SkillSource):
    def __init__(self, base_dir: Path) -> None:
        self._base_dir = Path(base_dir)

    def load(self) -> SkillLoadResult:
        base = self._base_dir
        if not base.is_dir():
            return SkillLoadResult(
                diagnostics=(
                    LoadDiagnostic(
                        str(base),
                        "warning",
                        "skills dir does not exist; no skills loaded",
                    ),
                )
            )
        skills: list[LoadedSkill] = []
        diagnostics: list[LoadDiagnostic] = []
        for path in sorted(base.rglob("*")):
            if _is_hidden(path, base):
                continue
            if not path.is_file():
                continue
            is_skill_md = path.name.lower() == _SKILL_MD_NAME
            if not is_skill_md and path.suffix.lower() not in {".yaml", ".yml"}:
                continue
            try:
                loaded = (
                    self._parse_skill_md(path, base)
                    if is_skill_md
                    else self._parse_one(path, base, diagnostics)
                )
            except (ValueError, ValidationError, yaml.YAMLError, OSError) as exc:
                diagnostics.append(LoadDiagnostic(str(path), "error", str(exc)))
                continue
            skills.append(loaded)
        return SkillLoadResult(tuple(skills), tuple(diagnostics))

    def _parse_one(
        self, path: Path, base: Path, diagnostics: list[LoadDiagnostic]
    ) -> LoadedSkill:
        data = _load_yaml_mapping(path)
        data["scope"] = _scope_for(path, base).model_dump()
        skill = _SKILL_ADAPTER.validate_python(data)
        body = self._resolve_playbook(skill, path, diagnostics)
        return LoadedSkill(skill=skill, playbook_body=body, source_path=str(path))

    def _parse_skill_md(self, path: Path, base: Path) -> LoadedSkill:
        """Parse an Agent-Skills `SKILL.md` into a playbook skill.

        The frontmatter `name` (falling back to the containing directory,
        the Agent-Skills convention) is the stable id; `description`
        doubles as the progressive-disclosure trigger unless an explicit
        `when_to_use` is given. The Markdown body is the on-demand
        playbook text. These directory skills are guidance only — they
        register no executable tools, so `tools` stays empty.
        """
        front, body = _split_frontmatter(path.read_text(encoding="utf-8"))
        name = str(front.get("name") or path.parent.name).strip()
        if not name:
            raise ValueError("SKILL.md has no usable name (frontmatter or directory)")
        description = str(front.get("description") or "").strip()
        when_to_use = str(front.get("when_to_use") or description).strip()
        skill = PlaybookSkill(
            kind="playbook",
            id=name,
            name=name,
            description=description,
            when_to_use=when_to_use,
            scope=_scope_for(path, base),
        )
        return LoadedSkill(
            skill=skill, playbook_body=body or None, source_path=str(path)
        )

    def _resolve_playbook(
        self, skill: Skill, path: Path, diagnostics: list[LoadDiagnostic]
    ) -> str | None:
        if not isinstance(skill, PlaybookSkill) or skill.playbook_ref is None:
            return None
        ref = (path.parent / skill.playbook_ref).resolve()
        # Containment guard: a manifest must not read files outside its own
        # directory via `../` or an absolute playbook_ref.
        try:
            ref.relative_to(path.parent.resolve())
        except ValueError:
            diagnostics.append(
                LoadDiagnostic(
                    str(path),
                    "warning",
                    f"playbook_ref {skill.playbook_ref!r} escapes the manifest "
                    "directory; ignored",
                )
            )
            return None
        try:
            return ref.read_text(encoding="utf-8").strip()
        except OSError as exc:
            diagnostics.append(
                LoadDiagnostic(
                    str(path),
                    "warning",
                    f"playbook_ref {skill.playbook_ref!r} unreadable: {exc}",
                )
            )
            return None
