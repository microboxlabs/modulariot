"""The per-run "Learned facts" block: approved authored cards, rendered into the
first user message so the model reads them without having to open them.

Cards are re-read from disk on each run (mtime-cached), so a card approved
mid-session applies on the next run without a restart.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from miot_harness.datasource.knowledge.loader import load_connection_cards_cached
from miot_harness.datasource.knowledge.models import KnowledgeCard

_HEADER = (
    "# Learned facts\n"
    "Your organization's trainers taught you these facts about its data. They "
    "take precedence over your own inference: when one applies, follow it for "
    "the tables, filters and definitions you use."
)


@dataclass(frozen=True)
class LearnedFactsSource:
    """One connection whose authored cards feed the block. `tenant_lock` is the
    connection's lock (None = any tenant)."""

    connection: str
    cards_dir: Path
    tenant_lock: str | None = None


def approved_cards(cards_dir: Path) -> tuple[KnowledgeCard, ...]:
    return tuple(c for c in load_connection_cards_cached(cards_dir).cards if c.status == "approved")


class LearnedFacts:
    def __init__(self, sources: Sequence[LearnedFactsSource], *, char_budget: int) -> None:
        self.sources = tuple(sorted(sources, key=lambda s: s.connection))
        self.char_budget = char_budget

    def render(self, tenant_id: str | None) -> str | None:
        """The block for `tenant_id`, or None when no card applies. Full bodies
        until the character budget is spent, then titles only. Deterministic for
        unchanged cards, so the cached prompt prefix survives across turns."""
        remaining = self.char_budget
        sections: list[str] = []
        for source in self.sources:
            if source.tenant_lock is not None and tenant_id != source.tenant_lock:
                continue
            cards = approved_cards(source.cards_dir)
            if cards:
                section, remaining = _render_section(source.connection, cards, remaining)
                sections.append(section)
        if not sections:
            return None
        return "\n\n".join([_HEADER, *sections])


def _render_section(
    connection: str, cards: Sequence[KnowledgeCard], remaining: int
) -> tuple[str, int]:
    """One connection's cards, and the budget left after them."""
    full: list[str] = []
    titles: list[str] = []
    for card in cards:
        entry = f"### {card.title}\n{card.body}"
        if not titles and len(entry) <= remaining:
            full.append(entry)
            remaining -= len(entry)
        else:
            titles.append(f"- {card.id}: {card.title}")
    parts = [f"## {connection}", *full]
    if titles:
        parts.append(
            f"More learned facts, titles only (open with `{connection}_knowledge`):\n"
            + "\n".join(titles)
        )
    return "\n\n".join(parts), remaining
