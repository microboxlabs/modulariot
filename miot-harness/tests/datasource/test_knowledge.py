"""Knowledge-pack loader, fingerprint detection, version probe (Phase 2 slice 2)."""

from __future__ import annotations

from pathlib import Path

import pytest

from miot_harness.datasource.knowledge.loader import (
    _parse_pack,
    detect_packs,
    load_packs,
    probe_version,
)
from miot_harness.datasource.knowledge.models import VersionProbe
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
    assert "mintral" not in pack.overview.lower()
    assert all("mintral" not in c.body.lower() for c in pack.cards)


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
