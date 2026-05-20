"""A1 smoke test: required OTel + Traceloop dependencies are importable.

Verifies Phase A's dependency set was added to ``pyproject.toml`` and resolved
via ``uv sync`` without version conflicts. These imports cover the public entry
points each Phase-A task relies on.
"""

from __future__ import annotations

import importlib

import pytest

PROD_MODULES = (
    "opentelemetry.trace",
    "opentelemetry.sdk.trace",
    "opentelemetry.sdk.resources",
    "opentelemetry.exporter.otlp.proto.grpc.trace_exporter",
    "opentelemetry.instrumentation.fastapi",
    "traceloop.sdk",
)

DEV_MODULES = ("pytest_opentelemetry",)


@pytest.mark.parametrize("module_name", PROD_MODULES)
def test_otel_runtime_dependencies_importable(module_name: str) -> None:
    importlib.import_module(module_name)


@pytest.mark.parametrize("module_name", DEV_MODULES)
def test_otel_dev_dependencies_importable(module_name: str) -> None:
    importlib.import_module(module_name)
