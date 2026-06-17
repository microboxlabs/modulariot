"""Source-kind selector (the Phase-2 swap point).

Mirrors `datasource/registry.py`: a tiny named registry that maps a
`*_source_kind` setting to a concrete `Source`. Today only `"file"` is
registered; a runtime API/DB-backed source is added here as a one-line
entry without touching the loader, supervisor, or lifespan.
"""

from __future__ import annotations

from pathlib import Path

from miot_harness.context_skills.file_source import FileContextSource, FileSkillSource
from miot_harness.context_skills.source import ContextSource, SkillSource


def resolve_context_source(kind: str, *, context_dir: Path) -> ContextSource:
    if kind == "file":
        return FileContextSource(context_dir)
    raise ValueError(f"unknown context source kind: {kind!r}")


def resolve_skill_source(kind: str, *, skills_dir: Path) -> SkillSource:
    if kind == "file":
        return FileSkillSource(skills_dir)
    raise ValueError(f"unknown skill source kind: {kind!r}")
