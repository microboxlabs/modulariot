"""TracerProvider configuration for the harness telemetry pipeline.

Wires the SDK against the OTel Collector sidecar shipped in
``infra/observability/`` (B1/B2). Call ``configure_tracing`` once from the
FastAPI lifespan (A4); call ``shutdown_tracing`` on shutdown so the batch
exporter flushes.
"""

from __future__ import annotations

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor


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
    """

    if not enabled:
        return None

    resource = Resource.create(
        {
            "service.name": service_name,
            "service.namespace": "modular",
            "deployment.environment": environment,
        }
    )
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint, insecure=True))
    )
    trace.set_tracer_provider(provider)
    return provider


def shutdown_tracing(provider: TracerProvider | None) -> None:
    if provider is None:
        return
    provider.shutdown()
