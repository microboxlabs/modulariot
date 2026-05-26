from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

from miot_harness.evals.run_golden import run_golden, validate_entries

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

    # No entry raised inside the runner.
    errored = [s["id"] for s in scored if s.get("notes")]
    assert not errored, f"runner errors: {errored}"

    # The over-engineering axis is populated for every non-refusal case and
    # left None for refusal cases.
    for s in scored:
        if s["refusal"] is None:  # not a refusal case
            assert s["step_economy"] is not None, f"{s['id']} missing step_economy"
        else:
            assert s["step_economy"] is None, f"{s['id']} should not score step_economy"


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
