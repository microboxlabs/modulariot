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

# A shared connection card records the MEANING of a business term, never
# row-level secret values — the security invariant of the loop ("memory informs,
# the boundary enforces"). These flag a body that embeds concrete sensitive data:
# an email address, or a numeric token of 9+ digits (a phone / national-id /
# account number). A definition ("entregas = task_def_key in (confirmDelivery)")
# never trips these; a leaked data row does.
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
# A numeric token: digits joined only by id/phone formatting (`.` `-` space) —
# NOT commas, so a definition enumerating codes ("1, 2, 3, …") doesn't false-trip
# while a RUT (12.345.678-9) or phone (+56 9 1234 5678) does.
_NUMERIC_TOKEN_RE = re.compile(r"\d[\d.\-\s]*\d")


def _reject_if_secretish(body: str) -> None:
    """Raise ValueError if the body looks like it carries a row-level secret
    rather than a term's meaning. Conservative on purpose: a false negative just
    stores a slightly over-specific card, but a false positive would block a
    legitimate definition, so only unambiguous data shapes (emails, long numeric
    ids) trip it."""
    if _EMAIL_RE.search(body):
        raise ValueError(
            "card body looks like it contains a row-level value (an email "
            "address); a shared card must state the term's MEANING, not data"
        )
    for token in _NUMERIC_TOKEN_RE.findall(body):
        if len(re.sub(r"\D", "", token)) >= 9:
            raise ValueError(
                "card body looks like it contains a row-level value (a long "
                "numeric id / phone / account); a shared card must state the "
                "term's MEANING, not data"
            )


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
    _reject_if_secretish(body)
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
