"""A4 — FastAPI lifespan wires `configure_tracing` + `Traceloop.init`."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from miot_harness.api.server import create_app
from miot_harness.config import get_settings


@pytest.fixture(autouse=True)
def _settings_cache() -> None:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_lifespan_skips_telemetry_when_otel_disabled(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))
    monkeypatch.setenv("MIOT_HARNESS_OTEL_ENABLED", "false")
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_DSN", raising=False)

    with (
        patch("miot_harness.api.server.configure_tracing") as configure_mock,
        patch("miot_harness.api.server.Traceloop") as traceloop_mock,
    ):
        configure_mock.return_value = None
        app = create_app()
        with TestClient(app) as client:
            assert client.get("/health").status_code == 200

    # configure_tracing is still called (it's responsible for the off-switch
    # gate); Traceloop.init is NOT — there's no provider to attach to.
    configure_mock.assert_called_once()
    kwargs = configure_mock.call_args.kwargs
    assert kwargs["enabled"] is False
    traceloop_mock.init.assert_not_called()


def test_lifespan_inits_traceloop_when_otel_enabled(monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))
    monkeypatch.setenv("MIOT_HARNESS_OTEL_ENABLED", "true")
    monkeypatch.setenv("MIOT_HARNESS_OTEL_ENDPOINT", "http://otel:4317")
    monkeypatch.setenv("MIOT_HARNESS_OTEL_SERVICE_NAME", "miot-harness-itest")
    monkeypatch.setenv("MIOT_HARNESS_OTEL_ENVIRONMENT", "itest")
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_DSN", raising=False)

    fake_provider = MagicMock(name="TracerProvider")
    with (
        patch(
            "miot_harness.api.server.configure_tracing", return_value=fake_provider
        ) as configure_mock,
        patch("miot_harness.api.server.Traceloop") as traceloop_mock,
        patch("miot_harness.api.server.shutdown_tracing") as shutdown_mock,
    ):
        app = create_app()
        with TestClient(app) as client:
            assert client.get("/health").status_code == 200

    # configure_tracing called with the wired settings.
    kwargs = configure_mock.call_args.kwargs
    assert kwargs["enabled"] is True
    assert kwargs["endpoint"] == "http://otel:4317"
    assert kwargs["service_name"] == "miot-harness-itest"
    assert kwargs["environment"] == "itest"

    # Traceloop.init called so Anthropic/OpenAI SDK calls auto-emit `gen_ai.*`
    # child spans against the provider configure_tracing just installed.
    traceloop_mock.init.assert_called_once()
    init_kwargs = traceloop_mock.init.call_args.kwargs
    assert init_kwargs.get("app_name") == "miot-harness-itest"

    # Lifespan shutdown flushes the provider.
    shutdown_mock.assert_called_once_with(fake_provider)
