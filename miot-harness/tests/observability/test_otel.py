"""TracerProvider configuration helpers (A2)."""

from __future__ import annotations

from opentelemetry.sdk.trace import TracerProvider

from miot_harness.observability.otel import configure_tracing, shutdown_tracing


def test_configure_tracing_returns_none_when_disabled() -> None:
    """An opt-out call must not return a provider — callers no-op on None."""

    provider = configure_tracing(
        enabled=False,
        service_name="x",
        endpoint="http://collector:4317",
        environment="test",
    )
    assert provider is None


def test_configure_tracing_builds_provider_with_resource_attrs() -> None:
    """Returned provider carries the OTel resource attrs Langfuse filters on."""

    provider = configure_tracing(
        enabled=True,
        service_name="miot-harness",
        endpoint="http://collector:4317",
        environment="local",
    )
    try:
        assert isinstance(provider, TracerProvider)
        resource_attrs = dict(provider.resource.attributes)
        assert resource_attrs["service.name"] == "miot-harness"
        assert resource_attrs["deployment.environment"] == "local"
        assert resource_attrs["service.namespace"] == "modular"
    finally:
        shutdown_tracing(provider)


def test_shutdown_tracing_handles_none() -> None:
    """Lifespan shutdown should not crash when tracing was disabled."""

    shutdown_tracing(None)
