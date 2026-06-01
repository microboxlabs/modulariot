"""Auth0 JWT verification for the harness API surface.

Pure module — no FastAPI imports. Wired into FastAPI in a later rung.

Trust model: the harness lives behind a Quarkus proxy that performs
the full Auth0 + Alfresco org-membership check. This module is the
in-process defense-in-depth layer: it re-verifies the same Auth0
RS256 token (signature, issuer, audience, expiry) so that anyone who
reaches the port without going through the proxy is rejected. The
authoritative tenant claim arrives as a header set by the proxy —
this module does not resolve tenancy.

RS256 only by design. HS256 (M2M) is terminated by Quarkus; if a
direct-M2M-to-harness path is ever added it goes in a separate
module so the algorithms cannot be confused.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from jwt import PyJWK
from jwt.exceptions import (
    ExpiredSignatureError,
    InvalidAudienceError,
    InvalidIssuerError,
    InvalidTokenError,
)


class AuthError(Exception):
    """Raised when a token fails any verification step.

    ``code`` is the machine-readable reason, one of:
    ``"invalid_signature"``, ``"expired"``, ``"wrong_issuer"``,
    ``"wrong_audience"``, ``"malformed"``.
    """

    __slots__ = ("code",)

    def __init__(self, code: str, message: str = "") -> None:
        self.code = code
        super().__init__(message or code)


@dataclass
class _CachedKey:
    key: Any  # cryptography RSAPublicKey, opaque to us
    fetched_at: float


class JwksCache:
    """Async JWKS resolver with a per-``kid`` TTL cache.

    The cache stores parsed public keys keyed by JWK ``kid``. A lookup
    that misses (or is past its TTL) triggers a refresh of the entire
    JWKS document under an ``asyncio.Lock``, so a burst of concurrent
    ``verify_token`` calls collapses into one HTTP fetch.

    Designed so tests can inject an ``httpx.AsyncClient`` with a
    ``MockTransport`` — no real network in CI.
    """

    def __init__(
        self,
        jwks_url: str,
        *,
        ttl_seconds: int = 600,
        http_client: httpx.AsyncClient | None = None,
        request_timeout: float = 5.0,
        min_refresh_interval: float = 10.0,
    ) -> None:
        self._url = jwks_url
        self._ttl = ttl_seconds
        self._client = http_client
        self._timeout = request_timeout
        # Floor between cache-miss-triggered refreshes. Caps the upstream
        # JWKS GET rate so a flood of tokens bearing unknown kids (or a
        # brief IdP outage) can't fetch once per request and trip Auth0's
        # JWKS rate limit, which would take auth down for everyone.
        self._min_refresh_interval = min_refresh_interval
        self._last_refresh = float("-inf")
        self._lock = asyncio.Lock()
        self._keys: dict[str, _CachedKey] = {}

    async def get_key(self, kid: str) -> Any:
        cached = self._keys.get(kid)
        if cached is not None and (time.monotonic() - cached.fetched_at) < self._ttl:
            return cached.key

        async with self._lock:
            # Re-check after acquiring the lock — a concurrent caller
            # may have just refreshed.
            cached = self._keys.get(kid)
            if cached is not None and (time.monotonic() - cached.fetched_at) < self._ttl:
                return cached.key
            now = time.monotonic()
            if (now - self._last_refresh) >= self._min_refresh_interval:
                # Stamp the attempt before awaiting so a refresh that
                # raises (IdP outage) still counts against the cooldown —
                # otherwise every request would retry and storm the IdP.
                self._last_refresh = now
                await self._refresh()
                cached = self._keys.get(kid)
            if cached is None:
                # Either the refresh just ran and the kid is genuinely
                # absent (signed by a key the IdP no longer publishes),
                # or we're inside the cooldown with nothing cached. Both
                # reject without another upstream fetch.
                raise AuthError("invalid_signature", f"unknown kid {kid!r}")
            return cached.key

    async def _refresh(self) -> None:
        client = self._client or httpx.AsyncClient()
        try:
            resp = await client.get(self._url, timeout=self._timeout)
            resp.raise_for_status()
            payload = resp.json()
        finally:
            if self._client is None:
                await client.aclose()

        now = time.monotonic()
        new_keys: dict[str, _CachedKey] = {}
        for entry in payload.get("keys", []):
            kid = entry.get("kid")
            if not kid:
                continue
            try:
                pyjwk = PyJWK(entry)
            except Exception:
                # Skip individual unparseable keys; a single bad JWK
                # should not poison the rest of the set.
                continue
            new_keys[kid] = _CachedKey(key=pyjwk.key, fetched_at=now)
        self._keys = new_keys


async def verify_token(
    token: str,
    *,
    issuer: str,
    audiences: list[str],
    jwks: JwksCache,
    leeway: int = 30,
) -> Mapping[str, Any]:
    """Verify an Auth0 RS256 token; return its claims or raise ``AuthError``.

    Checks performed (in order):
    1. JWT structure parses and the header is readable.
    2. Header ``alg`` is exactly ``RS256``.
    3. Header ``kid`` resolves to a key in the JWKS.
    4. Signature verifies under that key.
    5. ``exp`` is in the future (within ``leeway`` seconds).
    6. ``iss`` matches the configured issuer.
    7. ``aud`` matches one of the configured audiences.

    ``leeway`` defaults to 30s to absorb clock skew between Auth0 and
    the pod; raise it if you see flaky ``expired`` rejections.
    """
    try:
        header = jwt.get_unverified_header(token)
    except Exception as exc:
        raise AuthError("malformed", str(exc)) from exc

    alg = header.get("alg")
    if alg != "RS256":
        raise AuthError("malformed", f"unsupported alg {alg!r}; only RS256 accepted")

    kid = header.get("kid")
    if not isinstance(kid, str) or not kid:
        raise AuthError("malformed", "missing kid in header")

    key = await jwks.get_key(kid)

    try:
        claims = jwt.decode(
            token,
            key=key,
            algorithms=["RS256"],
            issuer=issuer,
            audience=audiences,
            leeway=leeway,
            options={"require": ["exp", "iss", "aud"]},
        )
    except ExpiredSignatureError as exc:
        raise AuthError("expired", str(exc)) from exc
    except InvalidIssuerError as exc:
        raise AuthError("wrong_issuer", str(exc)) from exc
    except InvalidAudienceError as exc:
        raise AuthError("wrong_audience", str(exc)) from exc
    except InvalidTokenError as exc:
        # Catch-all for signature failures, missing required claims,
        # and other malformed/invalid conditions. PyJWT raises this
        # for `InvalidSignatureError` (subclass), `MissingRequiredClaimError`,
        # `ImmatureSignatureError`, etc. We collapse signature/structure
        # failures into `invalid_signature` since the operator-facing
        # distinction does not matter at this layer.
        raise AuthError("invalid_signature", str(exc)) from exc

    return claims
