"""Verifies the debug=true tenant allow-list gate (plan: SSE rich events).

Debug runs leak full tool inputs / outputs over SSE, so the harness
refuses `debug=true` for any tenant not on the env-var allow-list.
"""

from __future__ import annotations

import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from miot_harness.config import get_settings


@pytest.fixture(autouse=True)
def _reset_settings_cache() -> Iterator[None]:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _client_with_env(env: dict[str, str]):
    for k, v in env.items():
        os.environ[k] = v
    get_settings.cache_clear()
    from miot_harness.api.server import create_app

    return TestClient(create_app())


def test_debug_allowlist_blocks_when_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MIOT_HARNESS_ALLOW_DEBUG_TENANTS", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "dummy")
    with _client_with_env({}) as client:
        r = client.post(
            "/runs",
            json={
                "message": "hi",
                "tenant_id": "any",
                "user_id": "u",
                "thread_id": "t",
                "debug": True,
            },
        )
    assert r.status_code == 403
    assert "debug=true is not permitted" in r.json()["detail"]


def test_debug_allowlist_blocks_unknown_tenant(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MIOT_HARNESS_ALLOW_DEBUG_TENANTS", "mintral-dev,mintral-stg")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "dummy")
    with _client_with_env({}) as client:
        r = client.post(
            "/runs?debug=true",
            json={
                "message": "hi",
                "tenant_id": "mintral-prod",
                "user_id": "u",
                "thread_id": "t",
            },
        )
    assert r.status_code == 403


def test_debug_allowlist_permits_listed_tenant(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MIOT_HARNESS_ALLOW_DEBUG_TENANTS", "mintral-dev")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "dummy")
    with _client_with_env({}) as client:
        r = client.post(
            "/runs",
            json={
                "message": "hi",
                "tenant_id": "mintral-dev",
                "user_id": "u",
                "thread_id": "t",
                "debug": True,
            },
        )
    # The request reached the supervisor (no 403). It may still 200 with
    # an "integration disabled" body since no Nexo DSN is wired in tests.
    assert r.status_code == 200


def test_debug_false_is_unaffected_by_allowlist(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MIOT_HARNESS_ALLOW_DEBUG_TENANTS", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "dummy")
    with _client_with_env({}) as client:
        r = client.post(
            "/runs",
            json={
                "message": "hi",
                "tenant_id": "any",
                "user_id": "u",
                "thread_id": "t",
            },
        )
    assert r.status_code == 200
