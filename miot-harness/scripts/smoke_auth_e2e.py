"""Tier-1 harness-only auth e2e smoke (issue #522).

Runs the REAL uvicorn server over loopback sockets with auth enabled,
a real HTTP JWKS endpoint (served from an in-process thread), real
RS256 tokens, and real SSE streaming. This complements the in-process
TestClient suite by exercising the actual server process + socket I/O.

No external Auth0, no LLM keys, no DB: the JWKS is forged in-process and
one run record is seeded on disk so the cross-tenant / 404 checks are
deterministic. Run from the miot-harness dir:

    uv run python scripts/smoke_auth_e2e.py

Exit code 0 = all checks passed; 1 = at least one failed.
"""

from __future__ import annotations

import json
import os
import socket
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

import httpx
import jwt as pyjwt
import uvicorn
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

ISSUER = "https://smoke-tenant.auth0.example/"
AUDIENCE = "https://harness.smoke.example/api"
KID = "smoke-kid-1"
TENANT_HEADER = "X-Miot-Tenant-Client-Id"
OWNER_TENANT = "gama-mobility"
OTHER_TENANT = "evil-corp"
SEED_RUN_ID = "run_seed_alice"
SEED_TENANT = "alice-corp"


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _make_jwks(private_key: rsa.RSAPrivateKey) -> dict[str, Any]:
    jwk = json.loads(RSAAlgorithm.to_jwk(private_key.public_key()))
    jwk.update({"kid": KID, "use": "sig", "alg": "RS256"})
    return {"keys": [jwk]}


def _make_token(private_key: rsa.RSAPrivateKey, *, expires_in: int = 3600) -> str:
    now = int(time.time())
    claims = {
        "iss": ISSUER,
        "aud": AUDIENCE,
        "sub": "auth0|smoke-user",
        "iat": now,
        "exp": now + expires_in,
    }
    return pyjwt.encode(claims, private_key, algorithm="RS256", headers={"kid": KID})


def _start_jwks_server(jwks_doc: dict[str, Any], port: int) -> ThreadingHTTPServer:
    body = json.dumps(jwks_doc).encode()

    class _Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_args: Any) -> None:  # silence access log
            return

    server = ThreadingHTTPServer(("127.0.0.1", port), _Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def _seed_record(workdir: str) -> None:
    """Persist a completed run owned by SEED_TENANT before boot."""
    from miot_harness.runtime.run_store import HarnessRunRecord, JsonRunStore

    JsonRunStore(Path(workdir)).save(
        HarnessRunRecord(
            run_id=SEED_RUN_ID, status="completed", tenant_id=SEED_TENANT
        )
    )


def _wait_health(base: str, timeout: float = 20.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            if httpx.get(f"{base}/health", timeout=2).status_code == 200:
                return
        except httpx.HTTPError:
            pass
        time.sleep(0.2)
    raise RuntimeError("harness did not become healthy in time")


class _Results:
    def __init__(self) -> None:
        self.rows: list[tuple[bool, str, str]] = []

    def check(self, name: str, ok: bool, detail: str = "") -> None:
        self.rows.append((ok, name, detail))

    def report_and_exit(self) -> None:
        print("\n=== Tier-1 auth e2e smoke results ===")
        for ok, name, detail in self.rows:
            mark = "PASS" if ok else "FAIL"
            line = f"[{mark}] {name}"
            if detail:
                line += f" — {detail}"
            print(line)
        failed = [r for r in self.rows if not r[0]]
        print(f"\n{len(self.rows) - len(failed)}/{len(self.rows)} checks passed")
        sys.exit(1 if failed else 0)


def main() -> None:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwks_doc = _make_jwks(key)
    jwks_port = _free_port()
    app_port = _free_port()
    base = f"http://127.0.0.1:{app_port}"
    token = _make_token(key)
    auth = {"Authorization": f"Bearer {token}"}
    r = _Results()

    jwks_server = _start_jwks_server(jwks_doc, jwks_port)

    with TemporaryDirectory() as workdir:
        os.environ.update(
            {
                "MIOT_HARNESS_AUTH_ENABLED": "true",
                "AUTH0_ISSUER": ISSUER,
                "AUTH0_JWKS_URL": f"http://127.0.0.1:{jwks_port}/jwks",
                "AUTH0_RS256_AUDIENCE": AUDIENCE,
                "MIOT_HARNESS_WORKSPACE_DIR": workdir,
            }
        )
        os.environ.pop("MIOT_HARNESS_NEXO_DSN", None)
        _seed_record(workdir)

        from miot_harness.api.server import create_app

        config = uvicorn.Config(
            create_app, factory=True, host="127.0.0.1", port=app_port,
            log_level="warning",
        )
        server = uvicorn.Server(config)
        threading.Thread(target=server.run, daemon=True).start()
        try:
            _wait_health(base)

            # 1. /health open without a token.
            resp = httpx.get(f"{base}/health", timeout=5)
            r.check("/health open (no token)", resp.status_code == 200,
                    f"status={resp.status_code}")

            # 2. /health/ready open without a token.
            resp = httpx.get(f"{base}/health/ready", timeout=5)
            r.check("/health/ready open (no token)", resp.status_code == 200,
                    f"status={resp.status_code}")

            # 3. POST /runs without a token → 401.
            resp = httpx.post(f"{base}/runs", json={"message": "hi"}, timeout=5)
            r.check("POST /runs no token → 401", resp.status_code == 401,
                    f"status={resp.status_code}")

            # 4. Valid token but missing tenant header → 401.
            resp = httpx.post(f"{base}/runs", json={"message": "hi"},
                              headers=auth, timeout=5)
            r.check("valid token, no tenant header → 401",
                    resp.status_code == 401 and "tenant_unresolved" in resp.text,
                    f"status={resp.status_code}")

            # 5. Valid token + tenant header on /runs:start → 202.
            resp = httpx.post(
                f"{base}/runs:start", json={"message": "hi"},
                headers={**auth, TENANT_HEADER: OWNER_TENANT}, timeout=10,
            )
            ok = resp.status_code == 202 and resp.json().get("run_id", "").startswith("run_")
            r.check("POST /runs:start valid → 202", ok, f"status={resp.status_code}")
            live_run_id = resp.json().get("run_id", "") if resp.status_code == 202 else ""

            # 6. SSE stream first-byte latency < 5s (owner).
            if live_run_id:
                t0 = time.monotonic()
                first_byte_dt = None
                status = None
                with httpx.stream(
                    "GET", f"{base}/runs/{live_run_id}/stream",
                    headers={**auth, TENANT_HEADER: OWNER_TENANT}, timeout=10,
                ) as s:
                    status = s.status_code
                    for chunk in s.iter_raw():
                        if chunk:
                            first_byte_dt = time.monotonic() - t0
                            break
                ok = status == 200 and first_byte_dt is not None and first_byte_dt < 5.0
                r.check("SSE owner stream → 200, first byte <5s", ok,
                        f"status={status}, first_byte={first_byte_dt:.3f}s"
                        if first_byte_dt is not None else f"status={status}, no bytes")
            else:
                r.check("SSE owner stream → 200, first byte <5s", False,
                        "no run_id from /runs:start")

            # 7. Cross-tenant GET on the seeded record → 403.
            resp = httpx.get(
                f"{base}/runs/{SEED_RUN_ID}",
                headers={**auth, TENANT_HEADER: OTHER_TENANT}, timeout=5,
            )
            r.check("cross-tenant GET /runs/{seed} → 403",
                    resp.status_code == 403 and "cross_tenant_replay" in resp.text,
                    f"status={resp.status_code}")

            # 8. Same-tenant GET on the seeded record → 200.
            resp = httpx.get(
                f"{base}/runs/{SEED_RUN_ID}",
                headers={**auth, TENANT_HEADER: SEED_TENANT}, timeout=5,
            )
            r.check("same-tenant GET /runs/{seed} → 200", resp.status_code == 200,
                    f"status={resp.status_code}")

            # 9. Cross-tenant stream of the seeded record → 403.
            resp = httpx.get(
                f"{base}/runs/{SEED_RUN_ID}/stream",
                headers={**auth, TENANT_HEADER: OTHER_TENANT}, timeout=5,
            )
            r.check("cross-tenant stream /runs/{seed} → 403",
                    resp.status_code == 403, f"status={resp.status_code}")

            # 10. Unknown run id → 404.
            resp = httpx.get(
                f"{base}/runs/run_does_not_exist",
                headers={**auth, TENANT_HEADER: OWNER_TENANT}, timeout=5,
            )
            r.check("GET /runs/{unknown} → 404", resp.status_code == 404,
                    f"status={resp.status_code}")
        finally:
            server.should_exit = True
            jwks_server.shutdown()

    r.report_and_exit()


if __name__ == "__main__":
    main()
