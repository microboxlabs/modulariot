from __future__ import annotations

import asyncio
from pathlib import Path

from miot_harness.evals.run_golden import run_golden

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
