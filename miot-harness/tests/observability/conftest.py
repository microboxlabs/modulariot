"""Shared fixtures for observability tests.

The pytest-opentelemetry plugin installs a real TracerProvider during
`pytest_configure`. OTel's global provider is install-once, so instead of
fighting it we attach an additional `SimpleSpanProcessor` + `InMemorySpanExporter`
to whatever provider is already global. Cleared between tests.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from opentelemetry import trace
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor, SpanExportResult
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter


class _NexoSpanFilter(InMemorySpanExporter):
    """In-memory exporter that drops pytest-opentelemetry's own fixture/test spans.

    pytest-opentelemetry attaches a TracerProvider that emits one span per test
    item, fixture, and runtest call. We only want spans the harness itself
    produced (everything we emit lives under `nexo.*` or `gen_ai.*`).
    """

    def export(self, spans: tuple[ReadableSpan, ...]) -> SpanExportResult:  # type: ignore[override]
        filtered = tuple(s for s in spans if s.name.startswith("nexo."))
        return super().export(filtered)


@pytest.fixture(scope="session")
def _session_exporter() -> Iterator[InMemorySpanExporter]:
    provider = trace.get_tracer_provider()
    if not isinstance(provider, TracerProvider):  # pragma: no cover
        # Shouldn't happen under pytest-opentelemetry, but fail loudly if it does.
        raise RuntimeError(
            f"Expected an SDK TracerProvider, got {type(provider).__name__}; "
            "observability tests cannot capture spans."
        )
    exporter = _NexoSpanFilter()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    yield exporter


@pytest.fixture()
def memory_exporter(_session_exporter: InMemorySpanExporter) -> Iterator[InMemorySpanExporter]:
    _session_exporter.clear()
    yield _session_exporter
    _session_exporter.clear()
