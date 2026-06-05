from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

from miot_harness.evals.run_golden import (
    DEFAULT_FALLBACK_TOOL,
    _build_fake_registry,
    run_golden,
    validate_entries,
)

GOLDEN_YAML = Path(__file__).resolve().parents[1] / "evals" / "golden" / "nexo" / "examples.yaml"


def test_golden_yaml_exists() -> None:
    assert GOLDEN_YAML.is_file(), f"golden dataset missing: {GOLDEN_YAML}"


def test_static_mode_validates(tmp_path: Path) -> None:
    payload = asyncio.run(run_golden(GOLDEN_YAML, tmp_path, mode="static"))
    assert payload["valid"] is True
    assert payload["errors"] == []


def test_fake_mode_runs_every_case_cleanly(tmp_path: Path) -> None:
    payload = asyncio.run(run_golden(GOLDEN_YAML, tmp_path, mode="fake"))
    assert payload["valid"] is True
    scored = payload["scored"]
    assert len(scored) >= 1

    # Only `runner_error:` notes are failures; other notes are intentional
    # annotations (e.g. nulled semantic refusals).
    errored = [s["id"] for s in scored if str(s.get("notes", "")).startswith("runner_error")]
    assert not errored, f"runner errors: {errored}"

    # freshness_citation / no_hallucination / step_economy are all gated by
    # expected_refusal: per case they are all set, or all None, together. (We
    # can't pivot on `refusal` here — semantic refusal cases now null it too.)
    for s in scored:
        gated = (s["freshness_citation"], s["no_hallucination"], s["step_economy"])
        assert all(v is None for v in gated) or all(v is not None for v in gated), (
            f"{s['id']} has inconsistent refusal-gated axes: {gated}"
        )


def test_fake_mode_records_reproducibility_env(tmp_path: Path) -> None:
    payload = asyncio.run(run_golden(GOLDEN_YAML, tmp_path, mode="fake"))
    env = payload["env"]
    assert env["deterministic"] is True
    assert env["python"]
    assert env["platform"]
    assert "synthesizer" in env["models"]


def _refusal_entry() -> dict[str, Any]:
    """A minimal, valid refusal-expected entry for validation tests."""
    return {
        "id": "x",
        "question": "q",
        "tenant_id": "mintral",
        "category": "adversarial",
        "expected_tools": [],
        "forbidden_tools": [],
        "expected_kpis_mentioned": [],
        "expected_freshness_cited": False,
        "expected_refusal": True,
        "expected_min_turns": 0,
        "expected_max_turns": 1,
        "refusal_mechanism": "semantic",
    }


def test_validate_requires_refusal_mechanism() -> None:
    entry = _refusal_entry()
    del entry["refusal_mechanism"]
    errors = validate_entries([entry])
    assert any("refusal_mechanism" in e for e in errors)


def test_validate_rejects_bad_refusal_mechanism() -> None:
    entry = _refusal_entry()
    entry["refusal_mechanism"] = "bogus"
    errors = validate_entries([entry])
    assert any("refusal_mechanism" in e for e in errors)


def test_validate_accepts_valid_refusal_mechanism() -> None:
    assert validate_entries([_refusal_entry()]) == []


def test_build_fake_registry_stubs_arbitrary_expected_tools() -> None:
    """The fake registry builds a stub for EVERY expected_tools name verbatim,
    with no prefix filter — so a dataset can ask for any tool name."""
    entry = {
        "id": "x",
        "tenant_id": "mintral",
        "expected_tools": ["weather_lookup", "ams_inventory", "totally_custom"],
    }
    registry = _build_fake_registry(entry)
    names = set(registry.names())
    assert {"weather_lookup", "ams_inventory", "totally_custom"} <= names
    # The fallback is always present so refusal cases still resolve.
    assert DEFAULT_FALLBACK_TOOL in names


def test_build_fake_registry_empty_expected_uses_fallback() -> None:
    """Refusal cases (empty expected_tools) still get the fallback tool."""
    registry = _build_fake_registry({"id": "x", "tenant_id": "mintral", "expected_tools": []})
    assert registry.names() == [DEFAULT_FALLBACK_TOOL]


def test_fake_mode_nulls_semantic_refusals(tmp_path: Path) -> None:
    payload = asyncio.run(run_golden(GOLDEN_YAML, tmp_path, mode="fake"))
    by_id = {s["id"]: s for s in payload["scored"]}

    # Structural refusal (tenant gate) is deterministic -> scored bool.
    structural = by_id["nexo-adversarial-002-tenant-mismatch"]
    assert structural["refusal"] is True

    # Semantic refusals cannot be produced by the scripted model -> None + note.
    semantic = by_id["nexo-adversarial-003-prompt-injection"]
    assert semantic["refusal"] is None
    assert "semantic" in semantic["notes"]
