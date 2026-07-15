"""Safety rails for the continual-learning loop — the guards between a distilled
CANDIDATE and an authoritative card.

None of these auto-apply anything. They INFORM the human gate (a conflict with an
existing definition, a card gone stale) and ENFORCE the security invariant of the
loop ("memory informs, the boundary enforces"): a shared fact states MEANING,
never a row-level value; a learned recipe is a template, and execution still
applies the caller's scope (tenant_lock) — the card never carries or grants
access. Auto-promotion is gated OFF by default (see `may_auto_promote`); earning
autonomy is a separate, explicit operator decision.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date

from miot_harness.datasource.knowledge.distiller import CandidateFact
from miot_harness.datasource.knowledge.models import KnowledgeCard
from miot_harness.datasource.knowledge.writer import _reject_if_secretish


@dataclass(frozen=True)
class Conflict:
    """A candidate whose term already has an authoritative card, but with a
    DIFFERENT meaning — must be escalated to a human, never auto-applied."""

    term: str
    candidate_body: str
    card_id: str
    card_body: str


def _norm(text: str) -> str:
    """Whitespace-collapsed, case-folded — so trivial formatting differences
    between two statements of the same meaning don't read as a conflict."""
    return " ".join(text.split()).casefold()


def detect_conflict(
    candidate: CandidateFact, cards: Iterable[KnowledgeCard]
) -> Conflict | None:
    """Return a `Conflict` when `candidate`'s term already has an APPROVED
    authoritative card whose meaning differs; else None. A card that states the
    same meaning is a re-confirmation, not a conflict. One card per term (the
    id is the term slug), so the first term match decides."""
    cand_term = candidate.term.strip().casefold()
    for card in cards:
        if card.status != "approved":
            continue
        card_term = (card.term or card.id).strip().casefold()
        if card_term != cand_term:
            continue
        if _norm(card.body) == _norm(candidate.body):
            return None  # same term, same meaning — re-confirmation
        return Conflict(
            term=candidate.term,
            candidate_body=candidate.body,
            card_id=card.id,
            card_body=card.body,
        )
    return None


def parse_iso_date(value: str) -> date | None:
    """Parse an ISO `YYYY-MM-DD` frontmatter date, or None if empty/malformed."""
    text = (value or "").strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def is_stale(last_confirmed: str, *, today: date, window_days: int) -> bool:
    """True when a card was last confirmed more than `window_days` before
    `today` — it should resurface for review rather than silently rot.

    A card with no (or an unparseable) `last_confirmed` returns False: its age is
    unknown, and nagging every un-dated card would be noise. `today` is injected
    so decay is deterministic and testable."""
    confirmed = parse_iso_date(last_confirmed)
    if confirmed is None:
        return False
    return (today - confirmed).days > window_days


def is_template_safe(body: str) -> bool:
    """True when `body` states MEANING, not a row-level value — the shared-card
    security invariant. Reuses the writer's reject rule so the boolean pre-check
    (for the gate/distiller) and the hard write-time guard stay in lock-step.
    Execution-time scope (tenant_lock) is enforced by the tenancy gate, which a
    card can never bypass — this only stops a card from *carrying* data."""
    try:
        _reject_if_secretish(body)
    except ValueError:
        return False
    return True


def may_auto_promote(
    candidate: CandidateFact,
    *,
    conflict: Conflict | None,
    auto_promote_enabled: bool,
    min_confidence: float,
) -> bool:
    """Whether `candidate` could be promoted WITHOUT a human — deliberately
    conservative and OFF by default. Returns True only when every guard clears:
    the operator has explicitly enabled autonomy, there is no conflict, the body
    carries no row-level secret, and confidence meets the bar. With
    `auto_promote_enabled=False` (the shipped default) this is always False, so
    the human gate is the only promotion path unless an operator opts out."""
    if not auto_promote_enabled:
        return False
    if conflict is not None:
        return False
    if not is_template_safe(candidate.body):
        return False
    if candidate.confidence is None or candidate.confidence < min_confidence:
        return False
    return True
