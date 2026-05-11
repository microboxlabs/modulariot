from __future__ import annotations

from miot_harness.integrations.nexo.primer import COORDINADOR_PRIMER


def test_primer_is_a_non_empty_string():
    assert isinstance(COORDINADOR_PRIMER, str)
    assert len(COORDINADOR_PRIMER) > 200


def test_primer_word_count_in_target_range():
    word_count = len(COORDINADOR_PRIMER.split())
    # Plan 12 calls for ~200 words. Allow a generous band.
    assert 150 <= word_count <= 320, f"primer word count {word_count} outside [150, 320]"


def test_primer_covers_required_topics():
    text = COORDINADOR_PRIMER.lower()
    # Per doc 10 lines 165-185, the primer must teach:
    for needle in (
        "service",  # service / proc_inst
        "pod",  # POD
        "eta",  # ETA buckets
        "fecha_tipo",  # date-type enum
        "es_critico",  # critical flag
        "refreshed_at",  # freshness rule
        "mintral",  # single-tenant lock
    ):
        assert needle in text, f"primer missing required topic: {needle}"


def test_primer_is_immutable_constant():
    """The primer is consumed verbatim by the analyst prompt; export it as
    a module-level constant rather than a function so prompt caching can
    actually cache the bytes."""
    import miot_harness.integrations.nexo.primer as mod

    assert hasattr(mod, "COORDINADOR_PRIMER")
    assert isinstance(mod.COORDINADOR_PRIMER, str)
