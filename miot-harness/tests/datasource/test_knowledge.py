"""Knowledge-pack loader, fingerprint detection, version probe (Phase 2 slice 2)."""

from __future__ import annotations

from pathlib import Path

import pytest

from miot_harness.datasource.knowledge.loader import (
    _parse_pack,
    detect_packs,
    load_connection_cards,
    load_packs,
    probe_version,
)
from miot_harness.datasource.knowledge.models import KnowledgeCard, VersionProbe
from tests.fixtures.recording_pool import RecordingPool

_PACK = """---
id: demo
title: Demo Product
fingerprint: [foo, bar]
version_probe:
  sql: "SELECT v FROM meta WHERE k = 'version'"
  label: Demo version
---

Overview line about the product.

## card: alpha · First card
Alpha body mentions foo.

## card: beta · Second card
Beta body mentions bar.
"""


def test_parse_pack_frontmatter_overview_and_cards() -> None:
    p = _parse_pack(_PACK, default_id="x")
    assert p.id == "demo"
    assert p.title == "Demo Product"
    assert p.fingerprint == ("foo", "bar")
    assert p.version_probe is not None
    assert p.overview.startswith("Overview line")
    assert [c.id for c in p.cards] == ["alpha", "beta"]
    assert p.card("alpha").title == "First card"
    assert "Alpha body" in p.card("alpha").body


def test_parse_pack_requires_fingerprint() -> None:
    with pytest.raises(ValueError, match="fingerprint"):
        _parse_pack("---\nid: x\ntitle: X\n---\nbody", default_id="x")


def test_detect_matches_only_when_all_fingerprint_tables_present() -> None:
    p = _parse_pack(_PACK, default_id="x")
    assert detect_packs(frozenset({"foo", "bar", "baz"}), (p,)) == [p]
    assert detect_packs(frozenset({"foo"}), (p,)) == []  # missing bar


@pytest.mark.asyncio
async def test_probe_version_sets_search_path_and_returns_value() -> None:
    pool = RecordingPool(fetch_return=[{"v": "6.0.0"}])
    probe = VersionProbe(sql="SELECT v FROM meta", label="x")
    version = await probe_version(pool=pool, probe=probe, schemas=("acs",))
    assert version == "6.0.0"
    assert any('search_path = "acs"' in s for s in pool.conn.executed)


@pytest.mark.asyncio
async def test_probe_version_none_when_no_rows() -> None:
    pool = RecordingPool(fetch_return=[])
    probe = VersionProbe(sql="SELECT v FROM meta", label="x")
    assert await probe_version(pool=pool, probe=probe, schemas=("acs",)) is None


def test_real_alfresco_pack_loads() -> None:
    packs_dir = (
        Path(__file__).resolve().parents[2]
        / "src"
        / "miot_harness"
        / "datasource"
        / "knowledge"
        / "packs"
    )
    result = load_packs(packs_dir)
    assert result.diagnostics == ()
    by_id = {p.id: p for p in result.packs}
    assert "alfresco-activiti" in by_id
    pack = by_id["alfresco-activiti"]
    assert "act_ru_task" in pack.fingerprint
    assert pack.version_probe is not None
    # The generic variables-pattern card exists and is product-generic (no
    # client specifics baked into the shipped pack).
    card = pack.card("workflow-business-data")
    assert card is not None and "act_ru_variable" in card.body
    assert "orion" not in pack.overview.lower()
    assert all("orion" not in c.body.lower() for c in pack.cards)


def test_load_packs_malformed_yaml_is_diagnostic_not_raise(tmp_path: Path) -> None:
    # Malformed frontmatter raises yaml.YAMLError (not ValueError); load_packs
    # must turn it into a diagnostic, never propagate (the "never raises" contract).
    d = tmp_path / "broken"
    d.mkdir()
    (d / "pack.md").write_text(
        "---\nid: x\nfingerprint: [a, b\n---\nbody", encoding="utf-8"
    )
    result = load_packs(tmp_path)  # must not raise
    assert result.packs == ()
    assert any("pack.md" in diag for diag in result.diagnostics)


# --- Connection-scoped AUTHORED cards (semantic-layer continual learning) ---

_CONN_CARD = """---
kind: stage
term: entregas
scope: tenant
status: approved
confidence: 0.9
---
"Entregas" = task_def_key_ IN ('confirmDelivery','receiveDelivery').
Excludes confirmArrival (that is despacho/transit).
"""


def test_load_connection_cards_parses_frontmatter_and_body(tmp_path: Path) -> None:
    d = tmp_path / "knowledge"
    d.mkdir()
    (d / "stage-entregas.md").write_text(_CONN_CARD, encoding="utf-8")
    result = load_connection_cards(d)
    assert result.diagnostics == ()
    assert len(result.cards) == 1
    card = result.cards[0]
    assert card.id == "entregas"  # derived from `term` when no explicit id
    assert card.term == "entregas"
    assert card.kind == "stage"
    assert card.scope == "tenant"
    assert card.status == "approved"
    assert card.confidence == 0.9
    assert card.source == "connection"
    assert "confirmDelivery" in card.body
    assert "confirmArrival" in card.body


def test_load_connection_cards_missing_dir_is_empty(tmp_path: Path) -> None:
    result = load_connection_cards(tmp_path / "does-not-exist")
    assert result.cards == ()
    assert result.diagnostics == ()


def test_load_connection_cards_bad_card_is_diagnostic_not_raise(tmp_path: Path) -> None:
    d = tmp_path / "knowledge"
    d.mkdir()
    # No frontmatter fence → rejected as a diagnostic (never served as knowledge).
    (d / "loose.md").write_text("just prose, no frontmatter", encoding="utf-8")
    # Valid card with no id/term → id falls back to the filename stem.
    (d / "term-patente.md").write_text(
        "---\nkind: term\n---\nUna patente con sufijo -V es un vehículo.\n",
        encoding="utf-8",
    )
    result = load_connection_cards(d)  # must not raise
    assert [c.id for c in result.cards] == ["term-patente"]
    assert any("loose.md" in diag for diag in result.diagnostics)


def test_load_connection_cards_bad_confidence_is_diagnostic(tmp_path: Path) -> None:
    d = tmp_path / "knowledge"
    d.mkdir()
    (d / "x.md").write_text(
        "---\nterm: foo\nconfidence: high\n---\nbody\n", encoding="utf-8"
    )
    result = load_connection_cards(d)
    assert result.cards == ()
    assert any("confidence" in diag for diag in result.diagnostics)


def test_connection_card_overrides_pack_card_of_same_id() -> None:
    # The provider appends connection cards AFTER pack cards, and
    # build_generic_tools indexes them as {c.id: c for c in cards} (last-wins),
    # so an authored client card overrides a generic pack card of the same id.
    pack_card = KnowledgeCard(id="entregas", title="pack", body="generic", source="pack")
    conn_card = KnowledgeCard(
        id="entregas", title="authored", body="client-specific", source="connection"
    )
    by_id = {c.id: c for c in [pack_card, conn_card]}
    assert by_id["entregas"].source == "connection"
    assert by_id["entregas"].body == "client-specific"
