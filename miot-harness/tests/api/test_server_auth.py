"""FastAPI auth wiring for /runs* endpoints.

Asserts the dependency contract:
- `auth_enabled=False`: legacy unauthenticated behavior preserved
  (existing tests in test_runs_stream.py rely on this).
- `auth_enabled=True`: every /runs* route demands a valid Auth0
  RS256 Bearer token; /health and /health/ready stay open.

Tokens are forged in-process with an RSA keypair; the JwksCache is
swapped onto `app.state.jwks` after the lifespan boots, so the
HTTP-level cache never reaches the real network.
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

ISSUER = "https://test-tenant.auth0.example/"
AUDIENCE = "https://harness.test.example/api"
JWKS_URL = "https://test-tenant.auth0.example/.well-known/jwks.json"
KID = "test-kid-1"


@pytest.fixture(autouse=True)
def _clean_env_and_workspace(
    tmp_path: Any, monkeypatch: pytest.MonkeyPatch
) -> Iterator[None]:
    """Per-test isolation: scrub auth + nexo env vars, point workspace
    at a tmp dir so /runs has somewhere to persist records."""
    for key in (
        "AUTH0_ISSUER",
        "AUTH0_JWKS_URL",
        "AUTH0_RS256_AUDIENCE",
        "MIOT_HARNESS_AUTH_ENABLED",
        "MIOT_HARNESS_AUTH_DIRECT_ALLOWED",
        "MIOT_HARNESS_NEXO_DSN",
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
    """Replace the live JwksCache with one served by an in-memory
    MockTransport. Must be called after the lifespan has set
    `app.state.jwks`, i.e. inside the TestClient context manager.
    """

    def _handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=jwks_payload)

    client = httpx.AsyncClient(transport=httpx.MockTransport(_handler))
    app.state.jwks = JwksCache(JWKS_URL, http_client=client)


def _make_token(
    private_key: RSAPrivateKey,
    *,
    issuer: str = ISSUER,
    audience: str | list[str] = AUDIENCE,
    expires_in: int = 3600,
) -> str:
    now = int(time.time())
    claims = {
        "iss": issuer,
        "aud": audience,
        "sub": "auth0|test-user",
        "iat": now,
        "exp": now + expires_in,
    }
    return pyjwt.encode(
        claims, private_key, algorithm="RS256", headers={"kid": KID}
    )


# ---------------------------------------------------------------------------
# Auth disabled (legacy mode) — existing surface untouched
# ---------------------------------------------------------------------------


def test_auth_disabled_runs_endpoint_open() -> None:
    """auth_enabled defaults to False: POST /runs accepts an
    unauthenticated request (legacy behavior that test_runs_stream.py
    and the demo CLI depend on)."""
    app = create_app()
    with TestClient(app) as client:
        resp = client.post("/runs", json={"message": "hi"})
    assert resp.status_code == 200, resp.text


# ---------------------------------------------------------------------------
# Auth enabled — /runs* gated, /health* open
# ---------------------------------------------------------------------------


def test_auth_enabled_no_header_returns_401(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        resp = client.post("/runs", json={"message": "hi"})
    assert resp.status_code == 401
    assert "Bearer" in resp.headers.get("WWW-Authenticate", "")


def test_auth_enabled_malformed_header_returns_401(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        resp = client.post(
            "/runs",
            json={"message": "hi"},
            headers={"Authorization": "NotBearer something"},
        )
    assert resp.status_code == 401


def test_auth_enabled_expired_token_returns_401(
    monkeypatch: pytest.MonkeyPatch,
    keypair: RSAPrivateKey,
    jwks_document: dict[str, Any],
) -> None:
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        _swap_jwks(app, jwks_document)
        token = _make_token(keypair, expires_in=-600)
        resp = client.post(
            "/runs",
            json={"message": "hi"},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 401
    assert "auth_failed:expired" in resp.text


def test_auth_enabled_wrong_audience_returns_401(
    monkeypatch: pytest.MonkeyPatch,
    keypair: RSAPrivateKey,
    jwks_document: dict[str, Any],
) -> None:
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        _swap_jwks(app, jwks_document)
        token = _make_token(keypair, audience="https://other.example/")
        resp = client.post(
            "/runs",
            json={"message": "hi"},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 401
    assert "auth_failed:wrong_audience" in resp.text


def test_auth_enabled_valid_token_reaches_handler(
    monkeypatch: pytest.MonkeyPatch,
    keypair: RSAPrivateKey,
    jwks_document: dict[str, Any],
) -> None:
    """A correctly-signed token gets past the dependency. We hit
    POST /runs:start which dispatches the supervisor as a background
    task and returns 202 immediately — proves auth let us through
    without coupling the test to a full /runs LLM run."""
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        _swap_jwks(app, jwks_document)
        token = _make_token(keypair)
        resp = client.post(
            "/runs:start",
            json={"message": "hi"},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 202, resp.text
    assert resp.json()["run_id"].startswith("run_")


def test_auth_enabled_health_endpoints_open(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        # /health/ready returns 200 when Nexo is not required.
        assert client.get("/health/ready").status_code == 200


def test_auth_enabled_stream_endpoint_rejects_without_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """GET /runs/{id}/stream is gated the same as POST /runs."""
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        resp = client.get("/runs/some_id/stream")
    assert resp.status_code == 401


def test_auth_enabled_runs_start_rejects_without_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /runs:start is gated the same as POST /runs."""
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        resp = client.post("/runs:start", json={"message": "hi"})
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Lifespan misconfiguration — boot must fail fast
# ---------------------------------------------------------------------------


def test_lifespan_rejects_auth_enabled_without_issuer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """validate_auth_config() runs in lifespan: an incomplete auth
    config raises on boot, not on the first request."""
    monkeypatch.setenv("MIOT_HARNESS_AUTH_ENABLED", "true")
    # Deliberately leave AUTH0_ISSUER unset.
    monkeypatch.setenv("AUTH0_JWKS_URL", JWKS_URL)
    monkeypatch.setenv("AUTH0_RS256_AUDIENCE", AUDIENCE)
    get_settings.cache_clear()
    app = create_app()
    with pytest.raises(ValueError, match="auth0_issuer"):
        with TestClient(app):
            pass
