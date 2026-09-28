"""The per-run "Learned facts" block: approved authored cards, rendered into the
first user message so the model reads them without having to open them.

Cards are re-read from disk on each run (mtime-cached), so a card approved
mid-session applies on the next run without a restart.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from pathlib import Path

from miot_harness.datasource.knowledge.loader import load_connection_cards_cached
from miot_harness.datasource.knowledge.models import KnowledgeCard
from miot_harness.knowledge.changes import KnowledgeChange, changes_for

_TITLE_CHARS = 120

_HEADER = (
    "# Learned facts\n"
    "Your organization's trainers taught you these facts about its data. They "
    "take precedence over your own inference: when one applies, follow it for "
    "the tables, filters and definitions you use."
)


_TRAINER_GUIDANCE = (
    "# Teaching mode\n"
    "The user is a trainer: they can change what you know about their organization. "
    "When they correct you or state a business rule that is not in your data or your "
    "knowledge, propose a change, then continue answering. Do not propose what you "
    "only inferred yourself.\n\n"
    "Where each kind of knowledge goes (file paths are for the ws_* tools):\n"
    "| Layer | File | Use for |\n"
    "|---|---|---|\n"
    "| fact | `facts/<connection>/<id>.md` | What a table, column, status or value "
    "means in one data source |\n"
    "| rule | `rules/<id>.md` | Organization rules and glossary terms that apply "
    "across data sources |\n"
    "| skill | `skills/<id>/SKILL.md` | A procedure for a kind of question: steps, "
    "filters, answer format |\n"
    "| primer | `primers/<connection>.md` | The description of a data source; body "
    "only, frontmatter is fixed |\n"
    "| eval | `evals/<id>.yaml` | A question with its expected answer, to test "
    "changes |\n"
    "| note | `notes/<connection>/<id>.md` | Your own notes; read or delete only |\n\n"
    "`base/` holds the shipped context and skills, read only; copy a shipped skill "
    "into `skills/` to change it. Look before you write (knowledge_list, ws_ls, "
    "ws_grep, ws_read) and update an item that covers the subject instead of adding "
    "a duplicate. Propose one file with ws_write, ws_edit or ws_delete, or several "
    "with propose_knowledge_change. The trainer approves each change from its diff; "
    "if they decline, ask what to change. After a change, offer to save the question "
    "it answers as an eval case. Connections that take facts: {connections}."
)


@dataclass(frozen=True)
class LearnedFactsSource:
    """One connection whose authored cards feed the block. `tenant_lock` is the
    connection's lock (None = any tenant)."""

    connection: str
    cards_dir: Path
    tenant_lock: str | None = None


def approved_cards(cards_dir: Path) -> tuple[KnowledgeCard, ...]:
    """Approved tenant-wide cards. Group-scoped cards are left out: a run does
    not carry the caller's groups, so there is no way to check membership."""
    return tuple(
        c
        for c in load_connection_cards_cached(cards_dir).cards
        if c.status == "approved" and c.scope == "tenant"
    )


def with_overlay(
    cards: Iterable[KnowledgeCard], connection: str, overlay: Iterable[KnowledgeChange]
) -> tuple[KnowledgeCard, ...]:
    """`cards` with a run's fact changes for `connection` applied, keyed by the
    card's file name (the id the knowledge store uses)."""
    changes = changes_for(overlay, "fact", connection)
    if not changes:
        return tuple(cards)
    by_stem = {c.file_stem or c.id: c for c in cards}
    for change in changes:
        if change.op == "delete":
            by_stem.pop(change.id, None)
        else:
            by_stem[change.id] = KnowledgeCard(
                id=change.id,
                title=change.title.strip() or change.id,
                body=change.content.strip(),
                source="connection",
                file_stem=change.id,
            )
    return tuple(sorted(by_stem.values(), key=lambda c: c.file_stem or c.id))


class LearnedFacts:
    def __init__(self, sources: Sequence[LearnedFactsSource], *, char_budget: int) -> None:
        self.sources = tuple(sorted(sources, key=lambda s: s.connection))
        self.char_budget = char_budget

    def usable(self, tenant_id: str | None) -> tuple[LearnedFactsSource, ...]:
        """The sources `tenant_id` may read and add facts to."""
        return tuple(s for s in self.sources if s.tenant_lock in (None, tenant_id))

    def trainer_guidance(self, tenant_id: str | None) -> str:
        """How a trainer's run changes the organization's knowledge."""
        names = [s.connection for s in self.usable(tenant_id)]
        return _TRAINER_GUIDANCE.format(
            connections=", ".join(f"`{n}`" for n in names) or "none"
        )

    def render(
        self, tenant_id: str | None, overlay: Iterable[KnowledgeChange] = ()
    ) -> str | None:
        """The block for `tenant_id`, or None when no card applies. Full bodies
        until the character budget is spent, then titles only. Deterministic for
        unchanged cards, so the cached prompt prefix survives across turns."""
        remaining = self.char_budget
        sections: list[str] = []
        for source in self.usable(tenant_id):
            cards = with_overlay(approved_cards(source.cards_dir), source.connection, overlay)
            if cards:
                section, remaining = _render_section(source.connection, cards, remaining)
                sections.append(section)
        if not sections:
            return None
        return "\n\n".join([_HEADER, *sections])


def _render_section(
    connection: str, cards: Sequence[KnowledgeCard], remaining: int
) -> tuple[str, int]:
    """One connection's cards, and the budget left after them. Titles count
    against the budget too; cards past it are only counted."""
    full: list[str] = []
    titles: list[str] = []
    omitted = 0
    for card in cards:
        entry = f"### {card.title}\n{card.body}"
        line = f"- {card.id}: {card.title[:_TITLE_CHARS]}"
        if not titles and not omitted and len(entry) <= remaining:
            full.append(entry)
            remaining -= len(entry)
        elif len(line) <= remaining:
            titles.append(line)
            remaining -= len(line)
        else:
            omitted += 1
    parts = [f"## {connection}", *full]
    if titles or omitted:
        tool = f"`{connection}_knowledge`"
        more = [f"More learned facts, titles only (open with {tool}):", *titles]
        if omitted:
            more.append(f"{omitted} more not listed; call {tool} with an empty card id.")
        parts.append("\n".join(more))
    return "\n\n".join(parts), remaining
