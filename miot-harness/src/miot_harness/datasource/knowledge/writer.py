"""Connection-card writer — the continual-learning APPLY seam.

When a human approves a learned business fact, the harness persists it as a
connection-scoped authored card in `<connection dir>/knowledge/<id>.md` — the
same directory + frontmatter format that `load_connection_cards` reads back, so
the very NEXT run grounds on it. This module is the inverse of
`_parse_connection_card` and the ONLY place that renders that file, so the two
stay in lock-step (a round-trip test pins them together).

Secret-safe by construction: a card records the MEANING of a business term
(e.g. which `task_def_key`s count as "entregas"), never row-level secret
values — the invariant the human gate enforces upstream.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slug_card_id(value: str) -> str:
    """Filesystem-safe stem for a card file: lowercased, every run of
    non-alphanumerics collapsed to '-', trimmed. Path separators, '.', and
    '..' cannot survive, so a caller-supplied term/id can never traverse out of
    the knowledge dir. Returns "" when nothing usable remains (caller rejects)."""
    return _SLUG_RE.sub("-", value.strip().lower()).strip("-")


@dataclass(frozen=True)
class ConnectionCardWrite:
    """The authored fields of a card to persist. `term` + `body` are required;
    the rest classify, scope, and provenance the fact for audit. `card_id`
    defaults to `slug(term)`; provenance/approved_by/last_confirmed are recorded
    in frontmatter for audit but ignored by the R0 loader."""

    term: str
    body: str
    kind: str = ""
    title: str = ""
    scope: str = "tenant"
    status: str = "approved"
    confidence: float | None = None
    card_id: str = ""
    approved_by: str = ""
    provenance: dict[str, Any] | list[Any] | None = None
    last_confirmed: str = ""


def render_connection_card(card: ConnectionCardWrite) -> str:
    """Render a card to markdown: a YAML frontmatter block (only populated
    keys) followed by the body. `yaml.safe_dump` handles all quoting, so the
    output always round-trips through `_parse_connection_card`'s
    `yaml.safe_load`."""
    term = card.term.strip()
    body = card.body.strip()
    if not term:
        raise ValueError("card term is required")
    if not body:
        raise ValueError("card body is required")
    card_id = slug_card_id(card.card_id or term)
    if not card_id:
        raise ValueError(f"cannot derive a card id from term {term!r}")

    # Ordered so the file reads top-down (identity, classification, provenance).
    front: dict[str, Any] = {
        "id": card_id,
        "term": term,
        "title": card.title.strip() or term,
        "kind": card.kind.strip(),
        "scope": card.scope.strip() or "tenant",
        "status": card.status.strip() or "approved",
    }
    if card.confidence is not None:
        front["confidence"] = float(card.confidence)
    if card.approved_by.strip():
        front["approved_by"] = card.approved_by.strip()
    if card.provenance is not None:
        front["provenance"] = card.provenance
    if card.last_confirmed.strip():
        front["last_confirmed"] = card.last_confirmed.strip()

    fm = yaml.safe_dump(front, sort_keys=False, allow_unicode=True)
    return f"---\n{fm}---\n\n{body}\n"


def write_connection_card(cards_dir: Path, card: ConnectionCardWrite) -> Path:
    """Write `card` into `cards_dir/<slug>.md`, creating the dir if needed, and
    return the path. Re-writing the same term overwrites the same file (an
    idempotent update: re-approval refreshes the card in place)."""
    stem = slug_card_id(card.card_id or card.term)
    if not stem:
        raise ValueError(f"cannot derive a card filename from term {card.term!r}")
    content = render_connection_card(card)  # validates term/body before any I/O
    cards_dir.mkdir(parents=True, exist_ok=True)
    path = cards_dir / f"{stem}.md"
    path.write_text(content, encoding="utf-8")
    return path
