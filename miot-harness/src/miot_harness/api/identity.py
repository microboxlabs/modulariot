"""Signed `X-MIOT-Identity` header.

Plan 07 gap 8 / Plan 08 §auth.

Format: `base64url(payload).base64url(hmac_sha256(secret, payload))`
where `payload` is a UTF-8 JSON object `{tenant_id, user_id, exp}` and
`exp` is a UNIX timestamp in seconds. The verifier rejects:
- malformed headers (missing dot, non-base64, non-JSON payload),
- bad signatures (constant-time compare),
- expired claims (`exp` + skew < now),
- missing required claims (`tenant_id`, `user_id`).

The harness ignores `tenant_id` / `user_id` from request bodies when a
valid header is present. When `identity_signing_key` is unset
(local dev / evals), the middleware is a no-op and body values pass
through unchanged — this is the gated dev bypass.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any


class IdentityVerificationError(Exception):
    """Raised when an `X-MIOT-Identity` header is present but invalid.

    The middleware translates this into a 401 with a generic message so
    the failure mode (bad sig vs expired vs malformed) doesn't leak.
    """


@dataclass(frozen=True)
class VerifiedIdentity:
    tenant_id: str
    user_id: str
    exp: int


def sign_identity(payload: dict[str, Any], secret: str) -> str:
    """Encode and sign a payload dict. Used by tests and the eval harness
    to mint a valid header without copy-pasting the wire format.
    """

    payload_bytes = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode(
        "utf-8"
    )
    payload_b64 = _b64url_encode(payload_bytes)
    sig = hmac.new(
        secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256
    ).digest()
    sig_b64 = _b64url_encode(sig)
    return f"{payload_b64}.{sig_b64}"


def verify_signed_identity(
    header: str, secret: str, *, skew_seconds: int = 60, now: float | None = None
) -> VerifiedIdentity:
    if "." not in header:
        raise IdentityVerificationError("malformed identity header")
    payload_b64, _, sig_b64 = header.partition(".")
    try:
        expected_sig = hmac.new(
            secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256
        ).digest()
        provided_sig = _b64url_decode(sig_b64)
    except (ValueError, UnicodeEncodeError) as exc:
        raise IdentityVerificationError("malformed identity header") from exc

    if not hmac.compare_digest(expected_sig, provided_sig):
        raise IdentityVerificationError("invalid identity signature")

    try:
        payload = json.loads(_b64url_decode(payload_b64))
    except (ValueError, UnicodeDecodeError) as exc:
        raise IdentityVerificationError("malformed identity payload") from exc
    if not isinstance(payload, dict):
        raise IdentityVerificationError("malformed identity payload")

    tenant_id = payload.get("tenant_id")
    user_id = payload.get("user_id")
    exp = payload.get("exp")
    if not isinstance(tenant_id, str) or not isinstance(user_id, str):
        raise IdentityVerificationError("missing tenant_id or user_id")
    if not isinstance(exp, int):
        raise IdentityVerificationError("missing or non-integer exp")

    current = now if now is not None else time.time()
    if exp + skew_seconds < current:
        raise IdentityVerificationError("identity expired")

    return VerifiedIdentity(tenant_id=tenant_id, user_id=user_id, exp=exp)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))
