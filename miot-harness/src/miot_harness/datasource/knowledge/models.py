"""Knowledge-pack model (Phase 2, slice 2).

A *pack* is curated, product-specific knowledge attached to a connection when its
schema matches a fingerprint — the semantic layer on top of structural
introspection. The engine is schema-agnostic; a pack is content (shipped/mounted
like skills) that declares everything product-specific:

- `fingerprint`: bare table names that must ALL be present for the pack to attach.
- `version_probe`: an optional SELECT (run schema-relative) that reports the
  product's schema version, and disambiguates look-alikes (Camunda vs Activiti
  both use act_*).
- `overview`: an always-loaded grounding block.
- `cards`: lazily-loaded knowledge units (title always in the index; body fetched
  on demand via the connection's `<conn>_knowledge` tool).

Packs ship GENERIC product knowledge only (e.g. "Activiti stores business data
as variables in act_ru_variable") — never client specifics (those are authored,
connection-scoped, in a later phase).
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class KnowledgeCard:
    id: str
    title: str
    body: str


@dataclass(frozen=True)
class VersionProbe:
    sql: str
    label: str


@dataclass(frozen=True)
class KnowledgePack:
    id: str
    title: str
    fingerprint: tuple[str, ...]
    overview: str
    cards: tuple[KnowledgeCard, ...] = ()
    version_probe: VersionProbe | None = None

    def matches(self, table_names: frozenset[str]) -> bool:
        """True iff every fingerprint table is present in the schema."""
        return bool(self.fingerprint) and all(
            t in table_names for t in self.fingerprint
        )

    def card(self, card_id: str) -> KnowledgeCard | None:
        for c in self.cards:
            if c.id == card_id:
                return c
        return None


@dataclass(frozen=True)
class DetectedPack:
    """A pack matched to a connection, with its resolved version (if probed)."""

    pack: KnowledgePack
    version: str | None = None


@dataclass(frozen=True)
class PackLoadResult:
    packs: tuple[KnowledgePack, ...] = ()
    diagnostics: tuple[str, ...] = field(default_factory=tuple)
