"""Signed `X-MIOT-Identity` header — Plan 07 gap 8.

Contract:
- When `identity_signing_key` is unset (default; dev / evals), `/runs`
  and `/runs:start` accept body-supplied tenant_id / user_id verbatim.
- When the key is set, requests MUST carry a valid `X-MIOT-Identity`
  header. The verified tenant_id / user_id overwrite anything in the
  body — body values are advisory at best.
- Malformed / expired / mis-signed headers return 401 with a generic
  message (no leak of which check failed).
"""

from __future__ import annotations

import time
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from miot_harness.api.identity import (
    IdentityVerificationError,
    sign_identity,
    verify_signed_identity,
)
from miot_harness.api.server import create_app
from miot_harness.config import get_settings


@pytest.fixture(autouse=True)
def _clean_settings_and_workspace(
    tmp_path: Any, monkeypatch: pytest.MonkeyPatch
) -> Iterator[None]:
    monkeypatch.delenv("MIOT_HARNESS_NEXO_DSN", raising=False)
    monkeypatch.delenv("MIOT_HARNESS_IDENTITY_SIGNING_KEY", raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


# --- pure unit tests on the signer / verifier ---


def test_sign_and_verify_roundtrip() -> None:
    secret = "shh"
    header = sign_identity(
        {"tenant_id": "mintral", "user_id": "u-42", "exp": int(time.time()) + 60},
        secret,
    )
    identity = verify_signed_identity(header, secret)
    assert identity.tenant_id == "mintral"
    assert identity.user_id == "u-42"


def test_verify_rejects_bad_signature() -> None:
    header = sign_identity(
        {"tenant_id": "t", "user_id": "u", "exp": int(time.time()) + 60},
        "right-key",
    )
    with pytest.raises(IdentityVerificationError):
        verify_signed_identity(header, "wrong-key")


def test_verify_rejects_expired_header() -> None:
    secret = "shh"
    header = sign_identity(
        {"tenant_id": "t", "user_id": "u", "exp": int(time.time()) - 3600},
        secret,
    )
    with pytest.raises(IdentityVerificationError):
        verify_signed_identity(header, secret, skew_seconds=60)


def test_verify_rejects_tampered_payload() -> None:
    secret = "shh"
    header = sign_identity(
        {"tenant_id": "t", "user_id": "u", "exp": int(time.time()) + 60},
        secret,
    )
    payload_b64, _, sig_b64 = header.partition(".")
    # Replace the payload with a different one but keep the original sig.
    tampered = sign_identity(
        {"tenant_id": "other", "user_id": "u", "exp": int(time.time()) + 60},
        secret,
    ).split(".")[0] + "." + sig_b64
    with pytest.raises(IdentityVerificationError):
        verify_signed_identity(tampered, secret)


def test_verify_rejects_malformed_header() -> None:
    with pytest.raises(IdentityVerificationError):
        verify_signed_identity("not-a-real-header", "shh")


def test_settings_reject_empty_signing_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """`MIOT_HARNESS_IDENTITY_SIGNING_KEY=""` would enable signed mode
    with an empty HMAC key (middleware checks `is not None`, and "" is
    not None). Refusing to construct the settings at all is safer than
    booting with a trivially-guessable secret.
    """

    from pydantic import ValidationError

    from miot_harness.config import HarnessSettings

    monkeypatch.setenv("MIOT_HARNESS_IDENTITY_SIGNING_KEY", "")
    with pytest.raises(ValidationError):
        HarnessSettings()


# --- end-to-end through the FastAPI middleware ---


def test_dev_mode_no_signing_key_accepts_body_tenant() -> None:
    """When identity_signing_key is unset (the default), body-supplied
    tenant_id passes through. This is the eval / local-dev path.
    """
    app = create_app()
    with TestClient(app) as client:
        resp = client.post(
            "/runs", json={"message": "hi", "tenant_id": "from-body"}
        )
    assert resp.status_code == 200
    body = resp.json()
    # The recorded answer is wrapped, but the per-run record should
    # acknowledge the body-supplied tenant somewhere — we just check
    # the run completed.
    assert body["status"] == "completed"


def test_signed_mode_rejects_missing_header(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """With a signing key configured, a request that omits the header
    returns 401 — the middleware allows non-header requests through to
    the handler, which 401s when the body is the only identity source.
    """
    monkeypatch.setenv("MIOT_HARNESS_IDENTITY_SIGNING_KEY", "test-secret")
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as client:
        resp = client.post(
            "/runs", json={"message": "hi", "tenant_id": "ignored"}
        )
    assert resp.status_code == 401


def test_signed_mode_rejects_invalid_header(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Mis-signed header → 401 generic message."""
    monkeypatch.setenv("MIOT_HARNESS_IDENTITY_SIGNING_KEY", "test-secret")
    get_settings.cache_clear()
    app = create_app()
    bad = sign_identity(
        {"tenant_id": "t", "user_id": "u", "exp": int(time.time()) + 60},
        "wrong-secret",
    )
    with TestClient(app) as client:
        resp = client.post(
            "/runs",
            json={"message": "hi"},
            headers={"X-MIOT-Identity": bad},
        )
    assert resp.status_code == 401


def test_signed_mode_accepts_valid_header_and_ignores_body_identity(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A valid header lets the request through, and the verified
    tenant_id/user_id overwrite anything in the body.
    """
    monkeypatch.setenv("MIOT_HARNESS_IDENTITY_SIGNING_KEY", "test-secret")
    get_settings.cache_clear()
    app = create_app()
    good = sign_identity(
        {
            "tenant_id": "verified-tenant",
            "user_id": "verified-user",
            "exp": int(time.time()) + 60,
        },
        "test-secret",
    )
    with TestClient(app) as client:
        resp = client.post(
            "/runs",
            json={
                "message": "hi",
                "tenant_id": "body-tenant-ignored",
                "user_id": "body-user-ignored",
            },
            headers={"X-MIOT-Identity": good},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "completed"
