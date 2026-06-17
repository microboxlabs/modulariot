"""The Source seam.

`ContextSource` / `SkillSource` are the boundary the rest of the harness
depends on. Phase 1 ships file-backed implementations
(`file_source.py`); a later runtime API/DB-backed source implements the
same interface and is swapped in via `registry_kind.py` with no change to
the loader, supervisor, or lifespan.

`load()` is intentionally synchronous: it runs once at boot and reads
local files (like the packaged defaults or a mounted ConfigMap). The HTTP
connector's *runtime* call stays async via `HarnessTool.call`. A future
async source can wrap its fetch in a sync boot shim, or we add `aload()`
alongside — the interface stays stable either way.

Contract (mirrors `DataSourceProvider.boot`): `load()` MUST NOT raise for
content/operational errors. Malformed input is captured as a
`LoadDiagnostic` and returned; only a programming bug should ever escape.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Literal

from miot_harness.context_skills.models import SystemContext
from miot_harness.context_skills.skill_models import LoadedSkill

DiagnosticLevel = Literal["error", "warning"]


@dataclass(frozen=True)
class LoadDiagnostic:
    """A non-fatal problem found while loading context/skill material."""

    path: str
    level: DiagnosticLevel
    message: str


@dataclass(frozen=True)
class ContextLoadResult:
    contexts: tuple[SystemContext, ...] = ()
    diagnostics: tuple[LoadDiagnostic, ...] = ()


@dataclass(frozen=True)
class SkillLoadResult:
    skills: tuple[LoadedSkill, ...] = ()
    diagnostics: tuple[LoadDiagnostic, ...] = field(default_factory=tuple)


class ContextSource(ABC):
    @abstractmethod
    def load(self) -> ContextLoadResult:
        """Load all context documents. Never raises on bad content."""
        ...


class SkillSource(ABC):
    @abstractmethod
    def load(self) -> SkillLoadResult:
        """Load all skill manifests. Never raises on bad content."""
        ...
