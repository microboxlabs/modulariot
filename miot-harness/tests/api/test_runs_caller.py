"""A run carries who started it, as the backend proxy forwarded it, so MCP
skills can call back as that user. The token must never land in the record."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from miot_harness.api.server import create_app
from miot_harness.config import get_settings

TOKEN = "caller-token-value"


@pytest.fixture(autouse=True)
def _clean_settings_and_workspace(tmp_path: Any, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_DSN", raising=False)
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_KIND", raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_the_proxys_token_and_organization_reach_the_run_but_not_the_record() -> None:
    app = create_app()
    seen: list[dict[str, Any]] = []
    with TestClient(app, headers={"X-Miot-Tenant-Client-Id": "demo-tenant"}) as client:
        harness = app.state.harness
        run = harness.run

        async def spy(request: Any, **kwargs: Any) -> Any:
            seen.append(kwargs)
            return await run(request, **kwargs)

        harness.run = spy
        resp = client.post(
            "/runs",
            json={"message": "hi"},
            headers={"Authorization": f"Bearer {TOKEN}", "X-Miot-Organization": "acme"},
        )

    assert resp.status_code == 200
    assert seen == [{"caller_token": TOKEN, "organization": "acme"}]
    assert TOKEN not in resp.text


def test_a_run_without_the_headers_has_no_caller() -> None:
    app = create_app()
    seen: list[dict[str, Any]] = []
    with TestClient(app, headers={"X-Miot-Tenant-Client-Id": "demo-tenant"}) as client:
        harness = app.state.harness
        run = harness.run

        async def spy(request: Any, **kwargs: Any) -> Any:
            seen.append(kwargs)
            return await run(request, **kwargs)

        harness.run = spy
        client.post("/runs", json={"message": "hi"})

    assert seen == [{"caller_token": None, "organization": None}]
