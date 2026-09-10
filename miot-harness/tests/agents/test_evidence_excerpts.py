"""Judge and synthesizer excerpts must not hide a full result behind a char cut."""

from miot_harness.agents.synthesizer import _render_evidence_for_synth
from miot_harness.agents.verifier import _summarize_evidence
from miot_harness.runtime.plan import DataEvidence
from miot_harness.utils.truncation import excerpt_for_prompt


def _catalog_rows(n: int) -> list[dict[str, object]]:
    return [
        {
            "name": f"public.api_modular_symptoms_{i:02d}",
            "args": "p_client_id text, p_from timestamptz, p_to timestamptz",
            "returns": "TABLE(trip_id bigint, symptom text, treatment text)",
            "kind": "function",
            "volatility": "stable",
            "language": "plpgsql",
            "summary": "Symptoms per trip for one client in a window." * 2,
            "meta": {"multitenancy": "p_client_id", "api": "public", "domain": "symptoms"},
        }
        for i in range(n)
    ]


def test_excerpt_keeps_five_rows_and_names_the_rest() -> None:
    text, note = excerpt_for_prompt({"rows": _catalog_rows(50), "total": 58}, 2500)
    assert note == "first 5 of 50 rows"
    assert text.count('"name"') == 5
    assert '"total": 58' in text


def test_excerpt_reports_char_cut_and_keeps_scalars() -> None:
    text, note = excerpt_for_prompt({"rows": _catalog_rows(3), "total": 3}, 200)
    assert text.startswith('{"total": 3, "rows": [')
    assert text.endswith(" ...")
    assert note == "cut at 200 chars"


def test_excerpt_silent_when_nothing_hidden() -> None:
    text, note = excerpt_for_prompt({"rows": [{"n": 1}]}, 200)
    assert note == ""
    assert text == '{"rows": [{"n": 1}]}'


def _evidence() -> DataEvidence:
    return DataEvidence(
        step_id="s1",
        tool="gps_functions",
        source="gps",
        refreshed_at=None,
        output={"rows": _catalog_rows(50), "total": 58, "source": "gps"},
        sample_size=50,
    )


def test_judge_summary_shows_rows_and_total() -> None:
    rendered = _summarize_evidence([_evidence()])
    assert "rows=50 excerpt=first 5 of 50 rows" in rendered
    assert rendered.count("api_modular_symptoms_") == 5
    assert '"total": 58' in rendered


def test_synth_evidence_shows_rows_and_total() -> None:
    rendered = _render_evidence_for_synth([_evidence()])
    assert "rows=50 excerpt=first 5 of 50 rows" in rendered
    assert rendered.count("api_modular_symptoms_") == 5
    assert '"total": 58' in rendered
