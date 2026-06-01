"""Hermetic unit tests for miot_harness.api.auth.

No real Auth0, no real network: a forged RSA keypair signs every
token, and ``httpx.MockTransport`` serves the JWKS document from
memory. Each test asserts a single branch of the verifier.
"""

from __future__ import annotations

import asyncio
import json
import time
from collections.abc import Iterator
from typing import Any

import httpx
import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey
from jwt.algorithms import RSAAlgorithm

from miot_harness.api.auth import AuthError, JwksCache, verify_token
from miot_harness.config import HarnessSettings

ISSUER = "https://test-tenant.auth0.example/"
AUDIENCE = "https://harness.test.example/api"
JWKS_URL = "https://test-tenant.auth0.example/.well-known/jwks.json"
KID = "test-kid-1"
OTHER_KID = "test-kid-2"


@pytest.fixture(autouse=True)
def _isolate_auth_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Strip any AUTH0_* / MIOT_HARNESS_AUTH_* env leakage per-test.

    The repo-wide conftest already clears MIOT_HARNESS_*; AUTH0_* are
    unprefixed (mirrored from quarkus-srv) so we clear them here too.
    """
    for key in (
        "AUTH0_ISSUER",
        "AUTH0_JWKS_URL",
        "AUTH0_RS256_AUDIENCE",
        "MIOT_HARNESS_AUTH_ENABLED",
        "MIOT_HARNESS_AUTH_DIRECT_ALLOWED",
    ):
        monkeypatch.delenv(key, raising=False)


@pytest.fixture(scope="session")
def keypair() -> RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(scope="session")
def other_keypair() -> RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _jwk_from_public_key(private_key: RSAPrivateKey, kid: str) -> dict[str, Any]:
    public_jwk = json.loads(RSAAlgorithm.to_jwk(private_key.public_key()))
    public_jwk["kid"] = kid
    public_jwk["use"] = "sig"
    public_jwk["alg"] = "RS256"
    return public_jwk


@pytest.fixture()
def jwks_document(keypair: RSAPrivateKey) -> dict[str, Any]:
    return {"keys": [_jwk_from_public_key(keypair, KID)]}


def _make_token(
    private_key: RSAPrivateKey,
    *,
    kid: str = KID,
    issuer: str = ISSUER,
    audience: str | list[str] = AUDIENCE,
    expires_in: int = 3600,
    extra_claims: dict[str, Any] | None = None,
    headers: dict[str, Any] | None = None,
    algorithm: str = "RS256",
) -> str:
    now = int(time.time())
    claims: dict[str, Any] = {
        "iss": issuer,
        "aud": audience,
        "sub": "auth0|test-user",
        "iat": now,
        "exp": now + expires_in,
    }
    if extra_claims:
        claims.update(extra_claims)
    full_headers = {"kid": kid}
    if headers:
        full_headers.update(headers)
    return pyjwt.encode(
        claims, private_key, algorithm=algorithm, headers=full_headers
    )


class _CountingTransport(httpx.MockTransport):
    """MockTransport that counts JWKS hits so the cache test can assert."""

    def __init__(self, jwks_payload: dict[str, Any]) -> None:
        self.hits = 0

        def _handler(request: httpx.Request) -> httpx.Response:
            self.hits += 1
            return httpx.Response(200, json=jwks_payload)

        super().__init__(_handler)


@pytest.fixture()
def jwks_with_client(
    jwks_document: dict[str, Any],
) -> Iterator[tuple[JwksCache, _CountingTransport]]:
    transport = _CountingTransport(jwks_document)
    client = httpx.AsyncClient(transport=transport)
    cache = JwksCache(JWKS_URL, http_client=client)
    # The client is not explicitly closed here: pytest-asyncio creates
    # a fresh event loop per test, so the connection pool is GC'd at
    # test teardown. Closing it from a sync fixture would have to spin
    # up a second loop and races with the test loop's shutdown.
    yield cache, transport


# ---------------------------------------------------------------------------
# verify_token branches
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_verify_token_valid(
    keypair: RSAPrivateKey, jwks_with_client: tuple[JwksCache, _CountingTransport]
) -> None:
    cache, transport = jwks_with_client
    token = _make_token(keypair)
    claims = await verify_token(
        token, issuer=ISSUER, audiences=[AUDIENCE], jwks=cache
    )
    assert claims["sub"] == "auth0|test-user"
    assert claims["iss"] == ISSUER
    assert claims["aud"] == AUDIENCE
    assert transport.hits == 1  # one JWKS fetch for the cold cache


@pytest.mark.asyncio
async def test_verify_token_expired(
    keypair: RSAPrivateKey, jwks_with_client: tuple[JwksCache, _CountingTransport]
) -> None:
    cache, _ = jwks_with_client
    # Token expired 10 minutes ago, well past the 30s leeway.
    token = _make_token(keypair, expires_in=-600)
    with pytest.raises(AuthError) as excinfo:
        await verify_token(
            token, issuer=ISSUER, audiences=[AUDIENCE], jwks=cache
        )
    assert excinfo.value.code == "expired"


@pytest.mark.asyncio
async def test_verify_token_wrong_issuer(
    keypair: RSAPrivateKey, jwks_with_client: tuple[JwksCache, _CountingTransport]
) -> None:
    cache, _ = jwks_with_client
    token = _make_token(keypair, issuer="https://attacker.example/")
    with pytest.raises(AuthError) as excinfo:
        await verify_token(
            token, issuer=ISSUER, audiences=[AUDIENCE], jwks=cache
        )
    assert excinfo.value.code == "wrong_issuer"


@pytest.mark.asyncio
async def test_verify_token_wrong_audience(
    keypair: RSAPrivateKey, jwks_with_client: tuple[JwksCache, _CountingTransport]
) -> None:
    cache, _ = jwks_with_client
    token = _make_token(keypair, audience="https://other-service.example/api")
    with pytest.raises(AuthError) as excinfo:
        await verify_token(
            token, issuer=ISSUER, audiences=[AUDIENCE], jwks=cache
        )
    assert excinfo.value.code == "wrong_audience"


@pytest.mark.asyncio
async def test_verify_token_bad_signature(
    other_keypair: RSAPrivateKey,
    jwks_with_client: tuple[JwksCache, _CountingTransport],
) -> None:
    # Token signed by `other_keypair`, but the JWKS only publishes the
    # main `keypair`'s public key. PyJWT rejects the signature → AuthError.
    cache, _ = jwks_with_client
    token = _make_token(other_keypair)  # kid=KID (lies about which key)
    with pytest.raises(AuthError) as excinfo:
        await verify_token(
            token, issuer=ISSUER, audiences=[AUDIENCE], jwks=cache
        )
    assert excinfo.value.code == "invalid_signature"


@pytest.mark.asyncio
async def test_verify_token_unknown_kid(
    keypair: RSAPrivateKey, jwks_with_client: tuple[JwksCache, _CountingTransport]
) -> None:
    cache, _ = jwks_with_client
    token = _make_token(keypair, kid=OTHER_KID)
    with pytest.raises(AuthError) as excinfo:
        await verify_token(
            token, issuer=ISSUER, audiences=[AUDIENCE], jwks=cache
        )
    assert excinfo.value.code == "invalid_signature"


@pytest.mark.asyncio
async def test_verify_token_malformed_not_a_jwt(
    jwks_with_client: tuple[JwksCache, _CountingTransport],
) -> None:
    cache, _ = jwks_with_client
    with pytest.raises(AuthError) as excinfo:
        await verify_token(
            "not-a-jwt", issuer=ISSUER, audiences=[AUDIENCE], jwks=cache
        )
    assert excinfo.value.code == "malformed"


@pytest.mark.asyncio
async def test_verify_token_wrong_alg_hs256(
    keypair: RSAPrivateKey, jwks_with_client: tuple[JwksCache, _CountingTransport]
) -> None:
    # Algorithm-confusion guard: a token claiming alg=HS256 must be
    # rejected even if (somehow) the body would otherwise verify. We
    # craft an HS256 token signed with a fake secret; the verifier
    # short-circuits on the alg check before touching the key.
    cache, _ = jwks_with_client
    # 32-byte secret to avoid PyJWT's InsecureKeyLengthWarning — the
    # length is unrelated to what we're testing (the alg-confusion
    # short-circuit).
    token = pyjwt.encode(
        {"iss": ISSUER, "aud": AUDIENCE, "exp": int(time.time()) + 60},
        "fake-shared-secret-padded-to-32-bytes!!",
        algorithm="HS256",
        headers={"kid": KID},
    )
    with pytest.raises(AuthError) as excinfo:
        await verify_token(
            token, issuer=ISSUER, audiences=[AUDIENCE], jwks=cache
        )
    assert excinfo.value.code == "malformed"


@pytest.mark.asyncio
async def test_verify_token_missing_kid(
    keypair: RSAPrivateKey, jwks_with_client: tuple[JwksCache, _CountingTransport]
) -> None:
    cache, _ = jwks_with_client
    # Build a token whose header has no `kid` by encoding directly and
    # then stripping it. Easier path: pyjwt.encode with empty headers
    # still injects `typ` but leaves `kid` out unless we add it.
    token = pyjwt.encode(
        {
            "iss": ISSUER,
            "aud": AUDIENCE,
            "exp": int(time.time()) + 60,
        },
        keypair,
        algorithm="RS256",
    )
    with pytest.raises(AuthError) as excinfo:
        await verify_token(
            token, issuer=ISSUER, audiences=[AUDIENCE], jwks=cache
        )
    assert excinfo.value.code == "malformed"


# ---------------------------------------------------------------------------
# JwksCache behavior
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_jwks_cache_hit_skips_refetch(
    keypair: RSAPrivateKey, jwks_with_client: tuple[JwksCache, _CountingTransport]
) -> None:
    cache, transport = jwks_with_client
    token = _make_token(keypair)
    await verify_token(token, issuer=ISSUER, audiences=[AUDIENCE], jwks=cache)
    await verify_token(token, issuer=ISSUER, audiences=[AUDIENCE], jwks=cache)
    await verify_token(token, issuer=ISSUER, audiences=[AUDIENCE], jwks=cache)
    assert transport.hits == 1  # all three calls hit the cached key


@pytest.mark.asyncio
async def test_jwks_cache_concurrent_refresh_collapses(
    keypair: RSAPrivateKey, jwks_document: dict[str, Any]
) -> None:
    transport = _CountingTransport(jwks_document)
    async with httpx.AsyncClient(transport=transport) as client:
        cache = JwksCache(JWKS_URL, http_client=client)
        token = _make_token(keypair)

        # 100 concurrent verify_token calls on a cold cache. The lock
        # collapses them into one JWKS fetch.
        results = await asyncio.gather(
            *[
                verify_token(
                    token, issuer=ISSUER, audiences=[AUDIENCE], jwks=cache
                )
                for _ in range(100)
            ]
        )

    assert len(results) == 100
    assert all(r["sub"] == "auth0|test-user" for r in results)
    assert transport.hits == 1


@pytest.mark.asyncio
async def test_jwks_cache_unknown_kid_flood_collapses_to_one_fetch(
    keypair: RSAPrivateKey, jwks_with_client: tuple[JwksCache, _CountingTransport]
) -> None:
    """A burst of tokens bearing unknown kids must not fetch the JWKS
    once per request. The refresh cooldown caps it at a single upstream
    GET so a forged-kid flood can't hammer Auth0's rate-limited endpoint
    and take auth down for legitimate callers."""
    cache, transport = jwks_with_client
    token = _make_token(keypair, kid=OTHER_KID)  # kid absent from JWKS
    for _ in range(20):
        with pytest.raises(AuthError) as excinfo:
            await verify_token(
                token, issuer=ISSUER, audiences=[AUDIENCE], jwks=cache
            )
        assert excinfo.value.code == "invalid_signature"
    assert transport.hits == 1  # cooldown collapses the flood


@pytest.mark.asyncio
async def test_jwks_cache_refresh_error_propagates_for_503_mapping(
    keypair: RSAPrivateKey,
) -> None:
    """A JWKS endpoint that errors surfaces as an httpx error out of
    get_key (the FastAPI layer maps it to a 503), not as an AuthError —
    'auth could not be performed' is distinct from 'token rejected'."""
    def _handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="upstream boom")

    async with httpx.AsyncClient(transport=httpx.MockTransport(_handler)) as client:
        cache = JwksCache(JWKS_URL, http_client=client)
        token = _make_token(keypair)
        with pytest.raises(httpx.HTTPError):
            await verify_token(
                token, issuer=ISSUER, audiences=[AUDIENCE], jwks=cache
            )


# ---------------------------------------------------------------------------
# HarnessSettings.validate_auth_config
# ---------------------------------------------------------------------------


def test_validate_auth_config_passes_when_disabled() -> None:
    settings = HarnessSettings(auth_enabled=False)
    settings.validate_auth_config()  # no raise


def test_validate_auth_config_passes_when_enabled_and_complete() -> None:
    settings = HarnessSettings(
        auth_enabled=True,
        auth0_issuer=ISSUER,
        auth0_jwks_url=JWKS_URL,
        auth0_rs256_audience=AUDIENCE,
    )
    settings.validate_auth_config()  # no raise


def test_validate_auth_config_raises_on_missing_issuer() -> None:
    settings = HarnessSettings(
        auth_enabled=True,
        auth0_jwks_url=JWKS_URL,
        auth0_rs256_audience=AUDIENCE,
    )
    with pytest.raises(ValueError, match="auth0_issuer"):
        settings.validate_auth_config()


def test_validate_auth_config_raises_on_missing_jwks_url() -> None:
    settings = HarnessSettings(
        auth_enabled=True,
        auth0_issuer=ISSUER,
        auth0_rs256_audience=AUDIENCE,
    )
    with pytest.raises(ValueError, match="auth0_jwks_url"):
        settings.validate_auth_config()


def test_validate_auth_config_raises_on_missing_audience() -> None:
    settings = HarnessSettings(
        auth_enabled=True,
        auth0_issuer=ISSUER,
        auth0_jwks_url=JWKS_URL,
    )
    with pytest.raises(ValueError, match="auth0_rs256_audience"):
        settings.validate_auth_config()


def test_settings_defaults_keep_auth_off() -> None:
    settings = HarnessSettings()
    assert settings.auth_enabled is False
    assert settings.auth0_issuer is None
    assert settings.auth0_jwks_url is None
    assert settings.auth0_rs256_audience is None
