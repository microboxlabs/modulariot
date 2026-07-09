"""Connection-card writer — round-trips through the R0 loader.

The writer is the inverse of `_parse_connection_card`; these tests pin the two
together so a written card is always loadable by the very next run, and prove
the caller-supplied term/id can never traverse out of the knowledge dir.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from miot_harness.datasource.knowledge.loader import (
    _parse_connection_card,
    load_connection_cards,
)
from miot_harness.datasource.knowledge.writer import (
    ConnectionCardWrite,
    render_connection_card,
    slug_card_id,
    write_connection_card,
)


def test_render_round_trips_through_the_loader() -> None:
    """A rendered card parses back with every authored field intact — the
    contract that keeps the writer and `_parse_connection_card` in lock-step."""
    card = ConnectionCardWrite(
        term="entregas",
        body="Solo `confirmDelivery` cuenta como entrega; `confirmArrival` no.",
        kind="stage",
        scope="tenant",
        status="approved",
        confidence=0.9,
    )
    parsed = _parse_connection_card(render_connection_card(card), default_id="x")
    assert parsed.id == "entregas"
    assert parsed.term == "entregas"
    assert parsed.title == "entregas"
    assert parsed.kind == "stage"
    assert parsed.scope == "tenant"
    assert parsed.status == "approved"
    assert parsed.confidence == 0.9
    assert parsed.source == "connection"
    assert "confirmDelivery" in parsed.body


def test_render_omits_confidence_when_absent() -> None:
    card = ConnectionCardWrite(term="foo", body="bar")
    text = render_connection_card(card)
    assert "confidence:" not in text
    assert _parse_connection_card(text, default_id="foo").confidence is None


def test_render_preserves_provenance_and_special_chars() -> None:
    """Audit metadata is recorded in frontmatter (the loader ignores it) and a
    term with YAML-special characters survives via `yaml.safe_dump` quoting."""
    card = ConnectionCardWrite(
        term="etapa: entregas",
        body="x",
        approved_by="ops@mintral.cl",
        provenance={"run_ids": ["run_1", "run_2"]},
        last_confirmed="2026-07-09",
    )
    text = render_connection_card(card)
    assert "approved_by: ops@mintral.cl" in text
    parsed = _parse_connection_card(text, default_id="x")
    # slug of the term collapses non-alnum runs to '-'.
    assert parsed.id == "etapa-entregas"
    assert parsed.term == "etapa: entregas"


def test_write_creates_dir_and_is_loadable(tmp_path: Path) -> None:
    cards_dir = tmp_path / "connections" / "acs" / "knowledge"
    path = write_connection_card(
        cards_dir,
        ConnectionCardWrite(term="entregas", body="body", kind="stage"),
    )
    assert path == cards_dir / "entregas.md"
    assert path.exists()
    result = load_connection_cards(cards_dir)
    assert result.diagnostics == ()
    assert [c.term for c in result.cards] == ["entregas"]


def test_write_same_term_overwrites_in_place(tmp_path: Path) -> None:
    """Re-approval refreshes the card rather than accumulating duplicates."""
    first = write_connection_card(tmp_path, ConnectionCardWrite(term="t", body="v1"))
    second = write_connection_card(tmp_path, ConnectionCardWrite(term="t", body="v2"))
    assert first == second
    assert list(tmp_path.glob("*.md")) == [first]
    assert "v2" in first.read_text(encoding="utf-8")


@pytest.mark.parametrize(
    ("term", "expected"),
    [
        ("../../etc/passwd", "etc-passwd"),
        ("a/b/c", "a-b-c"),
        ("Entregas Confirmadas", "entregas-confirmadas"),
        ("  ..  ", ""),
    ],
)
def test_slug_is_traversal_safe(term: str, expected: str) -> None:
    assert slug_card_id(term) == expected


def test_write_rejects_unsluggable_term(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="derive a card"):
        write_connection_card(tmp_path, ConnectionCardWrite(term="...", body="x"))


def test_render_rejects_empty_body() -> None:
    with pytest.raises(ValueError, match="body is required"):
        render_connection_card(ConnectionCardWrite(term="t", body="   "))


@pytest.mark.parametrize(
    "body",
    [
        "El responsable es ops@mintral.cl",  # email
        "El chofer +56 9 1234 5678 hace la entrega",  # phone (9+ digits)
        "RUT 12.345.678-9 del mandante",  # national id (9+ digits)
    ],
)
def test_render_rejects_row_level_secrets(body: str) -> None:
    """The security invariant: a shared card stores meaning, not concrete data."""
    with pytest.raises(ValueError, match="row-level value"):
        render_connection_card(ConnectionCardWrite(term="t", body=body))


@pytest.mark.parametrize(
    "body",
    [
        "entregas = task_def_key in (confirmDelivery); confirmArrival no cuenta",
        "El SLA es de 48 horas y el umbral 2024",  # short numbers are fine
    ],
)
def test_render_accepts_definitions_without_secrets(body: str) -> None:
    parsed = _parse_connection_card(
        render_connection_card(ConnectionCardWrite(term="entregas", body=body)),
        default_id="x",
    )
    assert parsed.body == body
