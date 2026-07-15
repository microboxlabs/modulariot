"""Safety rails between a distilled candidate and an authoritative card:
conflict detection, decay/last-confirmed, the no-row-level-secrets invariant, and
the off-by-default auto-promotion gate.
"""

from __future__ import annotations

from datetime import date

import pytest

from miot_harness.datasource.knowledge.distiller import CandidateFact
from miot_harness.datasource.knowledge.models import KnowledgeCard
from miot_harness.datasource.knowledge.safety import (
    Conflict,
    detect_conflict,
    is_stale,
    is_template_safe,
    may_auto_promote,
)


def _card(term: str, body: str, *, status: str = "approved") -> KnowledgeCard:
    return KnowledgeCard(
        id=term, title=term, body=body, term=term, status=status, source="connection"
    )


def _cand(term: str, body: str, *, confidence: float | None = 0.95) -> CandidateFact:
    return CandidateFact(connection="acs", term=term, body=body, confidence=confidence)


# --- conflict detection ------------------------------------------------------

def test_conflict_when_same_term_different_meaning() -> None:
    cards = [_card("entregas", "task_def_key in (confirmDelivery, receiveDelivery)")]
    candidate = _cand("entregas", "task_def_key in (confirmDelivery, confirmArrival)")
    conflict = detect_conflict(candidate, cards)
    assert isinstance(conflict, Conflict)
    assert conflict.term == "entregas"
    assert conflict.card_id == "entregas"


def test_no_conflict_when_same_meaning_reconfirmation() -> None:
    cards = [_card("entregas", "task_def_key in (confirmDelivery)")]
    # Same meaning, only whitespace/case differ → a re-confirmation, not a clash.
    candidate = _cand("Entregas", "task_def_key   in   (confirmDelivery)")
    assert detect_conflict(candidate, cards) is None


def test_no_conflict_when_term_unknown() -> None:
    cards = [_card("entregas", "x")]
    assert detect_conflict(_cand("despachos", "y"), cards) is None


def test_no_conflict_against_non_approved_card() -> None:
    # A staged card is not authoritative — a differing candidate is not (yet) a clash.
    cards = [_card("entregas", "old meaning", status="staged")]
    assert detect_conflict(_cand("entregas", "new meaning"), cards) is None


# --- decay / last-confirmed --------------------------------------------------

@pytest.mark.parametrize(
    ("last_confirmed", "expected"),
    [
        ("2026-01-01", True),   # ~189 days before today → past a 90-day window
        ("2026-06-20", False),  # within the window
        ("", False),            # unknown age → don't nag
        ("not-a-date", False),  # unparseable → don't nag
    ],
)
def test_is_stale(last_confirmed: str, expected: bool) -> None:
    today = date(2026, 7, 9)
    assert is_stale(last_confirmed, today=today, window_days=90) is expected


# --- no-row-level-secrets invariant ------------------------------------------

def test_is_template_safe_rejects_row_level_data() -> None:
    assert is_template_safe("entregas = task_def_key in (confirmDelivery)") is True
    assert is_template_safe("el chofer +56 9 1234 5678 hace la entrega") is False
    assert is_template_safe("responsable ops@mintral.cl") is False


# --- off-by-default auto-promotion gate --------------------------------------

def test_auto_promote_off_by_default_even_for_perfect_candidate() -> None:
    # A clean, high-confidence, conflict-free candidate STILL cannot self-promote
    # while the flag is off — the human gate is the only path by default.
    assert (
        may_auto_promote(
            _cand("entregas", "task_def_key in (confirmDelivery)", confidence=1.0),
            conflict=None,
            auto_promote_enabled=False,
            min_confidence=0.9,
        )
        is False
    )


def test_auto_promote_blocked_by_conflict_when_enabled() -> None:
    conflict = Conflict("entregas", "new", "entregas", "old")
    assert (
        may_auto_promote(
            _cand("entregas", "task_def_key in (confirmDelivery)", confidence=1.0),
            conflict=conflict,
            auto_promote_enabled=True,
            min_confidence=0.9,
        )
        is False
    )


def test_auto_promote_blocked_by_low_confidence_when_enabled() -> None:
    assert (
        may_auto_promote(
            _cand("entregas", "task_def_key in (confirmDelivery)", confidence=0.5),
            conflict=None,
            auto_promote_enabled=True,
            min_confidence=0.9,
        )
        is False
    )


def test_auto_promote_blocked_by_row_level_secret_when_enabled() -> None:
    assert (
        may_auto_promote(
            _cand("chofer", "el chofer +56 9 1234 5678", confidence=1.0),
            conflict=None,
            auto_promote_enabled=True,
            min_confidence=0.9,
        )
        is False
    )


def test_auto_promote_allowed_only_when_every_guard_clears() -> None:
    assert (
        may_auto_promote(
            _cand("entregas", "task_def_key in (confirmDelivery)", confidence=0.95),
            conflict=None,
            auto_promote_enabled=True,
            min_confidence=0.9,
        )
        is True
    )
