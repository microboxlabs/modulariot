"""File-backed Context & Skill sources.

Directory layout (a packaged default dir, or a mounted ConfigMap):

    <context_dir>/
        *.yaml | *.md                 -> global context docs
        tenants/<tenant_id>/*.yaml|md  -> per-tenant overlay docs

    <skills_dir>/
        **/*.yaml                      -> global skill manifests
        tenants/<tenant_id>/**/*.yaml  -> per-tenant skill manifests

The *directory* is authoritative for scope: a doc under
`tenants/<id>/` is tenant-scoped to `<id>` regardless of what its file
says (a conflicting in-file scope yields a warning, not a failure).

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
_SKILL_ADAPTER: TypeAdapter[Skill] = TypeAdapter(Skill)


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
            if not path.is_file() or path.suffix.lower() not in {".yaml", ".yml"}:
                continue
            try:
                loaded = self._parse_one(path, base, diagnostics)
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

    def _resolve_playbook(
        self, skill: Skill, path: Path, diagnostics: list[LoadDiagnostic]
    ) -> str | None:
        if not isinstance(skill, PlaybookSkill) or skill.playbook_ref is None:
            return None
        ref = (path.parent / skill.playbook_ref).resolve()
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
