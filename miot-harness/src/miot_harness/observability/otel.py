"""TracerProvider configuration for the harness telemetry pipeline.

Wires the SDK against the OTel Collector sidecar shipped in
``infra/observability/`` (B1/B2). Call ``configure_tracing`` once from the
FastAPI lifespan (A4); call ``shutdown_tracing`` on shutdown so the batch
exporter flushes.
"""

from __future__ import annotations

import logging
from urllib.parse import urlparse

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

logger = logging.getLogger(__name__)


def configure_tracing(
    *,
    enabled: bool,
    service_name: str,
    endpoint: str,
    environment: str,
) -> TracerProvider | None:
    """Install a TracerProvider with an OTLP/gRPC exporter and return it.

    When ``enabled`` is ``False`` returns ``None`` and leaves the global
    provider untouched; callers can no-op all downstream span work by
    checking the return value.

    OpenTelemetry's global provider is install-once. If something already
    installed a real ``TracerProvider`` (for example, pytest-opentelemetry
    at session start, or a previous lifespan iteration in a hot-reload
    scenario), we **return that existing provider** rather than silently
    handing back a detached new one whose spans would never reach the
    collector.
    """

    if not enabled:
        return None

    existing = trace.get_tracer_provider()
    if isinstance(existing, TracerProvider):
        logger.warning(
            "configure_tracing: TracerProvider already installed; reusing it "
            "(service=%s, env=%s). A second SDK provider would be silently "
            "detached.",
            service_name,
            environment,
        )
        return existing

    resource = Resource.create(
        {
            "service.name": service_name,
            "service.namespace": "modular",
            "deployment.environment": environment,
        }
    )
    provider = TracerProvider(resource=resource)
    # Disable TLS only for plaintext endpoints (http://, bare host:port).
    # `https://` endpoints get TLS automatically — never hardcode insecure.
    insecure = urlparse(endpoint).scheme != "https"
    provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint, insecure=insecure))
    )
    trace.set_tracer_provider(provider)
    return provider


def shutdown_tracing(provider: TracerProvider | None) -> None:
    if provider is None:
        return
    provider.shutdown()
