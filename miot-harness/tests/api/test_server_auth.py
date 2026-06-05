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
        "MIOT_HARNESS_DATASOURCE_DSN",
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


def _swap_failing_jwks(app: Any) -> None:
    """Replace the live JwksCache with one whose endpoint always 500s,
    to exercise the 'auth temporarily unavailable' path."""

    def _handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="upstream boom")

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
    """A correctly-signed token + the proxy's tenant header gets
    past the dependency. POST /runs:start dispatches the supervisor
    as a background task and returns 202 immediately — proves auth
    let us through without coupling the test to a full /runs LLM run.
    """
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        _swap_jwks(app, jwks_document)
        token = _make_token(keypair)
        resp = client.post(
            "/runs:start",
            json={"message": "hi"},
            headers={
                "Authorization": f"Bearer {token}",
                TENANT_HEADER: "gama-mobility",
            },
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


# ---------------------------------------------------------------------------
# R2: tenant resolution from X-Miot-Tenant-Client-Id header
# ---------------------------------------------------------------------------


TENANT_HEADER = "X-Miot-Tenant-Client-Id"


def test_auth_enabled_missing_tenant_header_returns_401(
    monkeypatch: pytest.MonkeyPatch,
    keypair: RSAPrivateKey,
    jwks_document: dict[str, Any],
) -> None:
    """Auth on: a valid Auth0 token without the proxy's
    `X-Miot-Tenant-Client-Id` header is rejected unconditionally.
    The proxy is the only trusted source of tenancy in prod; the
    R2-era `auth_direct_allowed` dev escape hatch was removed in R6.
    """
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        _swap_jwks(app, jwks_document)
        token = _make_token(keypair)
        resp = client.post(
            "/runs",
            json={"message": "hi"},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 401
    assert "tenant_unresolved" in resp.text


def test_header_tenant_overrides_body_tenant(
    monkeypatch: pytest.MonkeyPatch,
    keypair: RSAPrivateKey,
    jwks_document: dict[str, Any],
) -> None:
    """The header always wins. Body declaring tenant_id="evil-tenant"
    must end up persisted as the header value, not the body's lie."""
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        _swap_jwks(app, jwks_document)
        token = _make_token(keypair)
        resp = client.post(
            "/runs",
            json={"message": "hi", "tenant_id": "evil-tenant"},
            headers={
                "Authorization": f"Bearer {token}",
                TENANT_HEADER: "gama-mobility",
            },
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["tenant_id"] == "gama-mobility"


def test_runs_start_records_in_flight_tenant(
    monkeypatch: pytest.MonkeyPatch,
    keypair: RSAPrivateKey,
    jwks_document: dict[str, Any],
) -> None:
    """POST /runs:start tags the in-flight run with the verified
    tenant so /stream can refuse a cross-tenant subscriber while
    the run is still mid-flight."""
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        _swap_jwks(app, jwks_document)
        token = _make_token(keypair)
        resp = client.post(
            "/runs:start",
            json={"message": "hi"},
            headers={
                "Authorization": f"Bearer {token}",
                TENANT_HEADER: "gama-mobility",
            },
        )
        assert resp.status_code == 202, resp.text
        run_id = resp.json()["run_id"]
        # If the run completed instantly the cleanup callback fires
        # and the entry disappears — that's expected. Either the
        # entry exists and matches, or it's gone.
        tenant = app.state.in_flight_tenants.get(run_id)
        assert tenant in (None, "gama-mobility")


def test_cross_tenant_stream_replay_rejected(
    monkeypatch: pytest.MonkeyPatch,
    keypair: RSAPrivateKey,
    jwks_document: dict[str, Any],
    tmp_path: Any,
) -> None:
    """A persisted run with tenant_id="alice-corp" cannot be
    replayed via /stream by a token + header for "bob-corp" — 403.
    We seed the on-disk record directly via JsonRunStore to avoid
    coupling the test to the full /runs LLM path.
    """
    from miot_harness.runtime.run_store import HarnessRunRecord, JsonRunStore

    seeded_store = JsonRunStore(tmp_path)
    seeded_store.save(
        HarnessRunRecord(
            run_id="run_alice_xyz",
            status="completed",
            tenant_id="alice-corp",
        )
    )

    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        _swap_jwks(app, jwks_document)
        token = _make_token(keypair)
        resp = client.get(
            "/runs/run_alice_xyz/stream",
            headers={
                "Authorization": f"Bearer {token}",
                TENANT_HEADER: "bob-corp",
            },
        )
    assert resp.status_code == 403
    assert "cross_tenant_replay" in resp.text


def test_cross_tenant_get_run_rejected(
    monkeypatch: pytest.MonkeyPatch,
    keypair: RSAPrivateKey,
    jwks_document: dict[str, Any],
    tmp_path: Any,
) -> None:
    """Same as /stream but for GET /runs/{id} — refuse to hand back
    a persisted record to a caller from a different tenant."""
    from miot_harness.runtime.run_store import HarnessRunRecord, JsonRunStore

    seeded_store = JsonRunStore(tmp_path)
    seeded_store.save(
        HarnessRunRecord(
            run_id="run_alice_xyz",
            status="completed",
            tenant_id="alice-corp",
        )
    )

    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        _swap_jwks(app, jwks_document)
        token = _make_token(keypair)
        resp = client.get(
            "/runs/run_alice_xyz",
            headers={
                "Authorization": f"Bearer {token}",
                TENANT_HEADER: "bob-corp",
            },
        )
    assert resp.status_code == 403


def test_same_tenant_stream_replay_allowed(
    monkeypatch: pytest.MonkeyPatch,
    keypair: RSAPrivateKey,
    jwks_document: dict[str, Any],
    tmp_path: Any,
) -> None:
    """The legitimate owner of a run can still replay it — 403 must
    not fire on a matching tenant."""
    from miot_harness.runtime.run_store import HarnessRunRecord, JsonRunStore

    seeded_store = JsonRunStore(tmp_path)
    seeded_store.save(
        HarnessRunRecord(
            run_id="run_alice_xyz",
            status="completed",
            tenant_id="alice-corp",
        )
    )

    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        _swap_jwks(app, jwks_document)
        token = _make_token(keypair)
        with client.stream(
            "GET",
            "/runs/run_alice_xyz/stream",
            headers={
                "Authorization": f"Bearer {token}",
                TENANT_HEADER: "alice-corp",
            },
        ) as resp:
            # Reach the SSE path: 200 with text/event-stream. Drain
            # the body to release the connection.
            assert resp.status_code == 200, resp.read().decode()
            resp.read()


def test_legacy_record_without_tenant_id_still_loadable(
    monkeypatch: pytest.MonkeyPatch,
    keypair: RSAPrivateKey,
    jwks_document: dict[str, Any],
    tmp_path: Any,
) -> None:
    """Pre-#522 records on disk don't carry tenant_id — they should
    still load (Optional field, default None) and the cross-tenant
    guard treats `None` as legacy / allow-through, so existing
    deployments don't black-hole on upgrade."""
    from miot_harness.runtime.run_store import HarnessRunRecord, JsonRunStore

    seeded_store = JsonRunStore(tmp_path)
    seeded_store.save(
        HarnessRunRecord(run_id="run_legacy", status="completed")
    )

    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        _swap_jwks(app, jwks_document)
        token = _make_token(keypair)
        resp = client.get(
            "/runs/run_legacy",
            headers={
                "Authorization": f"Bearer {token}",
                TENANT_HEADER: "bob-corp",
            },
        )
    # Legacy record (tenant_id=None) is not refused.
    assert resp.status_code == 200, resp.text


# ---------------------------------------------------------------------------
# Failure-path hardening (review fixes)
# ---------------------------------------------------------------------------


def test_auth_enabled_jwks_unavailable_returns_503(
    monkeypatch: pytest.MonkeyPatch,
    keypair: RSAPrivateKey,
) -> None:
    """When the JWKS endpoint errors, verification cannot run: the
    harness returns a retryable 503 (auth temporarily unavailable) with
    a Retry-After header — not an opaque 500."""
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        _swap_failing_jwks(app)
        token = _make_token(keypair)
        resp = client.post(
            "/runs",
            json={"message": "hi"},
            headers={
                "Authorization": f"Bearer {token}",
                TENANT_HEADER: "gama-mobility",
            },
        )
    assert resp.status_code == 503, resp.text
    assert "jwks_fetch_failed" in resp.text
    assert resp.headers.get("Retry-After") == "5"


def test_get_run_unknown_id_returns_404(
    monkeypatch: pytest.MonkeyPatch,
    keypair: RSAPrivateKey,
    jwks_document: dict[str, Any],
) -> None:
    """GET /runs/{unknown} is a clean 404, not a 500 leaked from the
    run store's FileNotFoundError."""
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        _swap_jwks(app, jwks_document)
        token = _make_token(keypair)
        resp = client.get(
            "/runs/run_does_not_exist",
            headers={
                "Authorization": f"Bearer {token}",
                TENANT_HEADER: "gama-mobility",
            },
        )
    assert resp.status_code == 404, resp.text


def test_format_sse_error_escapes_injection() -> None:
    """A crafted run_id must not break out of the JSON payload or forge
    extra SSE frames: the data line stays a single valid JSON object
    carrying run_id as an escaped string."""
    from miot_harness.api.server import _format_sse_error

    malicious = 'x"]}\ndata: event: injected\ndata: pwned'
    frame = _format_sse_error(malicious, "unknown_run_id").decode()
    assert frame.startswith("event: error\ndata: ")
    assert frame.endswith("\n\n")
    body = frame[len("event: error\ndata: ") : -2]
    assert "\n" not in body  # no injected newline survived
    assert json.loads(body) == {
        "error": "unknown_run_id",
        "run_id": malicious,
    }


# ---------------------------------------------------------------------------
# Plan 07 endpoints (approvals / cancel) — gated the same as the rest
# of /runs* when auth is enabled, tenant-scoped via the in-flight map
# ---------------------------------------------------------------------------


def test_auth_enabled_cancel_rejects_without_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /runs/{id}/cancel is gated the same as POST /runs."""
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        resp = client.post("/runs/some_id/cancel")
    assert resp.status_code == 401


def test_auth_enabled_approvals_rejects_without_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST /runs/{id}/approvals/{aid} is gated the same as POST /runs."""
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        resp = client.post(
            "/runs/some_id/approvals/some_aid",
            json={"decision": "approve"},
        )
    assert resp.status_code == 401


def test_cross_tenant_cancel_returns_404(
    monkeypatch: pytest.MonkeyPatch,
    keypair: RSAPrivateKey,
    jwks_document: dict[str, Any],
) -> None:
    """A run started by alice-corp cannot be cancelled by a bob-corp
    caller — collapsed to the same 404 as a missing run so the
    endpoint leaks neither existence nor ownership. The in-flight
    task must NOT be cancelled."""
    from unittest.mock import Mock

    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        _swap_jwks(app, jwks_document)
        token = _make_token(keypair)
        task = Mock()
        app.state.in_flight["run_alice"] = task
        app.state.in_flight_tenants["run_alice"] = "alice-corp"
        resp = client.post(
            "/runs/run_alice/cancel",
            headers={
                "Authorization": f"Bearer {token}",
                TENANT_HEADER: "bob-corp",
            },
        )
    assert resp.status_code == 404
    task.cancel.assert_not_called()


def test_same_tenant_cancel_allowed(
    monkeypatch: pytest.MonkeyPatch,
    keypair: RSAPrivateKey,
    jwks_document: dict[str, Any],
) -> None:
    """The owning tenant can still cancel its own in-flight run."""
    from unittest.mock import Mock

    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        _swap_jwks(app, jwks_document)
        token = _make_token(keypair)
        task = Mock()
        app.state.in_flight["run_alice"] = task
        app.state.in_flight_tenants["run_alice"] = "alice-corp"
        resp = client.post(
            "/runs/run_alice/cancel",
            headers={
                "Authorization": f"Bearer {token}",
                TENANT_HEADER: "alice-corp",
            },
        )
    assert resp.status_code == 204
    task.cancel.assert_called_once()


def test_cross_tenant_approval_returns_404(
    monkeypatch: pytest.MonkeyPatch,
    keypair: RSAPrivateKey,
    jwks_document: dict[str, Any],
) -> None:
    """An approval pending on alice-corp's run cannot be resolved by a
    bob-corp caller — same 404 as an unknown approval, checked against
    the in-flight tenant map before the registry is consulted."""
    _enable_auth(monkeypatch)
    app = create_app()
    with TestClient(app) as client:
        _swap_jwks(app, jwks_document)
        token = _make_token(keypair)
        app.state.in_flight_tenants["run_alice"] = "alice-corp"
        registry = app.state.harness.approval_registry
        approval_id = "aid_alice_test"
        registry.register(approval_id, "run_alice")
        resp = client.post(
            f"/runs/run_alice/approvals/{approval_id}",
            json={"decision": "approve"},
            headers={
                "Authorization": f"Bearer {token}",
                TENANT_HEADER: "bob-corp",
            },
        )
        assert resp.status_code == 404
        # The decision must not have been recorded by the rejected call.
        assert registry.decision(approval_id) is None
        registry.discard(approval_id)
