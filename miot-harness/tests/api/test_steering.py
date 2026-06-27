"""HTTP contract for the live steering channel (Steering Plan C, Task 5).

`POST /runs/{run_id}/steer` pushes free-text operator guidance into a running
agentic loop; `POST /runs/{run_id}/interrupt` requests a cooperative stop.

The happy-path / unknown-run / validation cases run with auth disabled (the
legacy default these api tests use). The cross-tenant cases need auth enabled
so `require_auth` resolves a real caller tenant — otherwise `caller` is None
and the tenant guard is a no-op. The auth scaffolding (forged RS256 token +
in-memory JwksCache) mirrors test_server_auth.py exactly.
"""

from __future__ import annotations

import json
import time
from collections.abc import Iterator
from typing import Any

import httpx
import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey
from fastapi.testclient import TestClient
from jwt.algorithms import RSAAlgorithm

from miot_harness.api.auth import JwksCache
from miot_harness.api.server import create_app
from miot_harness.config import get_settings
from miot_harness.runtime.steering import SteeringRegistry

ISSUER = "https://test-tenant.auth0.example/"
AUDIENCE = "https://harness.test.example/api"
JWKS_URL = "https://test-tenant.auth0.example/.well-known/jwks.json"
KID = "test-kid-1"
TENANT_HEADER = "X-Miot-Tenant-Client-Id"


@pytest.fixture(autouse=True)
def _clean(tmp_path: Any, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    for key in (
        "AUTH0_ISSUER",
        "AUTH0_JWKS_URL",
        "AUTH0_RS256_AUDIENCE",
        "MIOT_HARNESS_AUTH_ENABLED",
        "MIOT_HARNESS_DATASOURCE_DSN",
        "MIOT_HARNESS_IDENTITY_SIGNING_KEY",
    ):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(scope="session")
def keypair() -> RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture()
def jwks_document(keypair: RSAPrivateKey) -> dict[str, Any]:
    public_jwk = json.loads(RSAAlgorithm.to_jwk(keypair.public_key()))
    public_jwk["kid"] = KID
    public_jwk["use"] = "sig"
    public_jwk["alg"] = "RS256"
    return {"keys": [public_jwk]}


def _enable_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MIOT_HARNESS_AUTH_ENABLED", "true")
    monkeypatch.setenv("AUTH0_ISSUER", ISSUER)
    monkeypatch.setenv("AUTH0_JWKS_URL", JWKS_URL)
    monkeypatch.setenv("AUTH0_RS256_AUDIENCE", AUDIENCE)
    get_settings.cache_clear()


def _swap_jwks(app: Any, jwks_payload: dict[str, Any]) -> None:
    def _handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=jwks_payload)

    client = httpx.AsyncClient(transport=httpx.MockTransport(_handler))
    app.state.jwks = JwksCache(JWKS_URL, http_client=client)


def _make_token(private_key: RSAPrivateKey) -> str:
    now = int(time.time())
    claims = {
        "iss": ISSUER,
        "aud": AUDIENCE,
        "sub": "auth0|test-user",
        "iat": now,
        "exp": now + 3600,
    }
    return pyjwt.encode(
        claims, private_key, algorithm="RS256", headers={"kid": KID}
    )


# ── /steer ────────────────────────────────────────────────────────────────


def test_steer_happy_path_returns_202_and_pushes_note() -> None:
    app = create_app()
    with TestClient(app) as client:
        reg: SteeringRegistry = app.state.harness.steering_registry
        reg.open("run_x")
        app.state.in_flight_tenants["run_x"] = "demo-tenant"
        resp = client.post("/runs/run_x/steer", json={"message": "focus on logs"})
        assert resp.status_code == 202
        assert reg.drain("run_x") == ["focus on logs"]


def test_steer_empty_message_returns_422() -> None:
    app = create_app()
    with TestClient(app) as client:
        reg: SteeringRegistry = app.state.harness.steering_registry
        reg.open("run_x")
        app.state.in_flight_tenants["run_x"] = "demo-tenant"
        resp = client.post("/runs/run_x/steer", json={"message": "   "})
        assert resp.status_code == 422
        # Validator rejects before the handler: nothing pushed.
        assert reg.drain("run_x") == []


def test_steer_unknown_run_returns_404() -> None:
    app = create_app()
    with TestClient(app) as client:
        # No channel opened, not in in_flight_tenants.
        resp = client.post("/runs/run_missing/steer", json={"message": "hi"})
        assert resp.status_code == 404
        # No-leak: detail does not reveal whether the run exists.
        assert resp.json()["detail"] == "Run not steerable"


def test_steer_cross_tenant_returns_404_and_does_not_push(
    monkeypatch: pytest.MonkeyPatch,
    keypair: RSAPrivateKey,
    jwks_document: dict[str, Any],
) -> None:
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        _swap_jwks(app, jwks_document)
        token = _make_token(keypair)
        reg: SteeringRegistry = app.state.harness.steering_registry
        reg.open("run_w")
        # Owned by a different tenant than the caller (gama-mobility).
        app.state.in_flight_tenants["run_w"] = "someone-else"
        resp = client.post(
            "/runs/run_w/steer",
            json={"message": "leak?"},
            headers={
                "Authorization": f"Bearer {token}",
                TENANT_HEADER: "gama-mobility",
            },
        )
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Run not steerable"
        # Tenant check runs before the registry: nothing pushed.
        assert reg.drain("run_w") == []


# ── /interrupt ──────────────────────────────────────────────────────────────


def test_interrupt_happy_path_returns_202_and_sets_flag() -> None:
    app = create_app()
    with TestClient(app) as client:
        reg: SteeringRegistry = app.state.harness.steering_registry
        reg.open("run_x")
        app.state.in_flight_tenants["run_x"] = "demo-tenant"
        resp = client.post("/runs/run_x/interrupt")
        assert resp.status_code == 202
        assert reg.is_interrupted("run_x") is True


def test_interrupt_unknown_run_returns_404() -> None:
    app = create_app()
    with TestClient(app) as client:
        resp = client.post("/runs/run_missing/interrupt")
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Run not interruptible"


def test_interrupt_cross_tenant_returns_404_and_does_not_set_flag(
    monkeypatch: pytest.MonkeyPatch,
    keypair: RSAPrivateKey,
    jwks_document: dict[str, Any],
) -> None:
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        _swap_jwks(app, jwks_document)
        token = _make_token(keypair)
        reg: SteeringRegistry = app.state.harness.steering_registry
        reg.open("run_w")
        app.state.in_flight_tenants["run_w"] = "someone-else"
        resp = client.post(
            "/runs/run_w/interrupt",
            headers={
                "Authorization": f"Bearer {token}",
                TENANT_HEADER: "gama-mobility",
            },
        )
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Run not interruptible"
        # Tenant check runs before the registry: flag never set.
        assert reg.is_interrupted("run_w") is False
