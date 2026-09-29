"""Backend-agnostic asyncpg pool factory.

Two envelopes:

**transaction** (default) — no startup `server_settings` other than
`application_name`, because PgBouncer in transaction-pooling mode rejects
unknown startup parameters. Read-only enforcement and the statement timeout are
applied per call (`BEGIN READ ONLY` + `SET LOCAL statement_timeout`). Five
round trips per query including the pool's reset on release.

**session** — `default_transaction_read_only=on` and `statement_timeout` as
connection startup settings, and no reset on release. One round trip per
query. Only for connections with no transaction-mode pooler in front (a 1:1
proxy, or the server itself), and only with a role whose grants alone enforce
read-only: `default_transaction_read_only` is a session setting, so the
transaction envelope's guarantee (a started read-only transaction cannot be
switched) becomes the role's grants plus the SQL gate, which admits only
`pg_catalog` builtins from its allowlist. A call that passes a different
timeout than the pinned one falls back to the transaction envelope.

This lives under `datasource/` (not `integrations/nexo/`) so generic
connections can build pools without importing the Nexo integration.
"""

from __future__ import annotations

from typing import Any

import asyncpg

ENVELOPES = ("transaction", "session")


class SessionPool:
    """An asyncpg pool whose connections carry the read-only envelope as
    session state. `fetch_readonly` and friends check `session_envelope` and
    skip the per-call BEGIN / SET LOCAL / COMMIT when the call's timeout is
    the pinned one."""

    session_envelope = True

    def __init__(self, inner: asyncpg.Pool, *, statement_timeout_ms: int) -> None:
        self._inner = inner
        self.statement_timeout_ms = statement_timeout_ms

    def acquire(self) -> Any:
        return self._inner.acquire()

    async def close(self) -> None:
        await self._inner.close()

    def terminate(self) -> None:
        self._inner.terminate()


async def _no_reset(_conn: asyncpg.Connection) -> None:
    return None


async def create_pg_pool(
    dsn: str,
    *,
    min_size: int = 1,
    max_size: int = 4,
    application_name: str | None = None,
    envelope: str = "transaction",
    statement_timeout_ms: int | None = None,
    **extra: Any,
) -> asyncpg.Pool | SessionPool:
    """Create a pool for `dsn`. `envelope` is "transaction" or "session"; the
    session envelope needs `statement_timeout_ms` to pin the timeout at
    connection start."""
    if not dsn:
        raise ValueError("create_pg_pool requires a non-empty `dsn`")
    if envelope not in ENVELOPES:
        raise ValueError(f"envelope must be one of {ENVELOPES}, got {envelope!r}")
    settings: dict[str, str] = {}
    if application_name:
        settings["application_name"] = application_name
    if envelope == "session":
        if not statement_timeout_ms or statement_timeout_ms <= 0:
            raise ValueError("the session envelope requires a positive statement_timeout_ms")
        settings["default_transaction_read_only"] = "on"
        settings["statement_timeout"] = str(int(statement_timeout_ms))
        extra["reset"] = _no_reset
    if settings:
        extra["server_settings"] = settings
    pool = await asyncpg.create_pool(
        dsn=dsn,
        min_size=min_size,
        max_size=max_size,
        **extra,
    )
    if envelope == "session":
        return SessionPool(pool, statement_timeout_ms=int(statement_timeout_ms or 0))
    return pool
