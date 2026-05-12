"""TracerProvider configuration helpers (A2)."""

from __future__ import annotations

from unittest.mock import patch

from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.trace import ProxyTracerProvider

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


def test_configure_tracing_builds_provider_with_resource_attrs_on_fresh_global() -> None:
    """First call (no real provider installed yet) builds a fresh SDK provider."""

    # Simulate a fresh OTel global by mocking get_tracer_provider to a Proxy.
    # We don't actually install ours globally — the side-effect-free assertion
    # is on the returned provider's resource attrs and processor pipeline.
    with patch(
        "miot_harness.observability.otel.trace.get_tracer_provider",
        return_value=ProxyTracerProvider(),
    ), patch(
        "miot_harness.observability.otel.trace.set_tracer_provider"
    ) as set_mock:
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
            set_mock.assert_called_once_with(provider)
        finally:
            shutdown_tracing(provider)


def test_configure_tracing_reuses_existing_provider_instead_of_silent_drop() -> None:
    """Second call (global already installed) reuses it — no detached provider."""

    pre_installed = TracerProvider()
    try:
        with patch(
            "miot_harness.observability.otel.trace.get_tracer_provider",
            return_value=pre_installed,
        ), patch(
            "miot_harness.observability.otel.trace.set_tracer_provider"
        ) as set_mock:
            returned = configure_tracing(
                enabled=True,
                service_name="miot-harness-second",
                endpoint="http://collector:4317",
                environment="prod",
            )
            assert returned is pre_installed
            set_mock.assert_not_called()
    finally:
        pre_installed.shutdown()


def test_shutdown_tracing_handles_none() -> None:
    """Lifespan shutdown should not crash when tracing was disabled."""

    shutdown_tracing(None)
