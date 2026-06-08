"""Repo-wide test isolation.

The harness's `.env` file lives at `miot-harness/.env` and operators are
expected to populate it (Nexo DSN, ANTHROPIC_API_KEY, OTel toggles…).
Pydantic-settings auto-loads that file every time `HarnessSettings()`
is constructed, which means a populated dev `.env` silently changes
the "default" values the unit tests assert against.

This conftest pins ``HarnessSettings.model_config["env_file"]`` to a
non-existent path for the test session so every `HarnessSettings()`
sees stock defaults unless the test itself sets env vars via
``monkeypatch.setenv``.

Also clears `MIOT_HARNESS_*` env vars (and `ANTHROPIC_API_KEY` / etc.)
that may leak in from the developer's shell, so the same suite passes
deterministically on CI and on a populated dev box.
"""

from __future__ import annotations

import os
from collections.abc import Iterator

import pytest
from opentelemetry import trace
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

from miot_harness.config import HarnessSettings

_HARNESS_SPAN_PREFIXES = (
    "nexo.",
    # Alternate datasource prefixes: "fake." for FakeProvider tests, and
    # "datasource." — the neutral default span_prefix when no profile is set.
    "fake.",
    "datasource.",
    # Traceloop / OpenLLMetry auto-instrumentation emits spans like
    # `anthropic.chat`, `openai.chat`, `gen_ai.completion`.
    "gen_ai.",
    "anthropic.",
    "openai.",
)


class _HarnessSpanExporter(InMemorySpanExporter):
    """In-memory exporter that drops pytest-opentelemetry's per-test spans.

    pytest-opentelemetry attaches a TracerProvider that emits one span per
    test item / fixture / runtest call. We keep only spans produced by the
    harness datasource providers (`nexo.*`, plus the alternate prefixes
    `fake.*` for FakeProvider tests and `datasource.*`, the neutral default
    span_prefix when no profile is set) and by the auto-instrumented LLM SDKs.
    """

    def export(self, spans: tuple[ReadableSpan, ...]) -> SpanExportResult:  # type: ignore[override]
        filtered = tuple(s for s in spans if s.name.startswith(_HARNESS_SPAN_PREFIXES))
        return super().export(filtered)


@pytest.fixture(scope="session")
def _session_exporter() -> Iterator[InMemorySpanExporter]:
    provider = trace.get_tracer_provider()
    if not isinstance(provider, TracerProvider):  # pragma: no cover
        raise RuntimeError(
            f"Expected an SDK TracerProvider, got {type(provider).__name__}; "
            "telemetry tests cannot capture spans."
        )
    exporter = _HarnessSpanExporter()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    yield exporter


@pytest.fixture()
def memory_exporter(_session_exporter: InMemorySpanExporter) -> Iterator[InMemorySpanExporter]:
    """Cleared between tests; available to every test file in the suite."""

    _session_exporter.clear()
    yield _session_exporter
    _session_exporter.clear()


@pytest.fixture(autouse=True)
def _isolate_settings_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Per-test: pretend `.env` doesn't exist and clear MIOT_HARNESS_* envs."""

    # Disable `.env` discovery for this test. Pydantic-settings reads
    # `model_config["env_file"]` lazily on each construction.
    monkeypatch.setitem(HarnessSettings.model_config, "env_file", "/nonexistent/.env")

    # Drop any inherited env values that would override defaults.
    for key in list(os.environ.keys()):
        if key.startswith("MIOT_HARNESS_") or key in {
            "ANTHROPIC_API_KEY",
            "OPENAI_API_KEY",
            "GOOGLE_API_KEY",
        }:
            monkeypatch.delenv(key, raising=False)
