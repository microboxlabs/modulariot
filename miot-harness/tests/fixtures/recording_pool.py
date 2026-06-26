"""A recording asyncpg-shaped pool for tests (no real DB).

Captures the read-only transaction flag, `SET LOCAL statement_timeout`, and the
SQL/args each query would run; returns a fixed result set per fetch.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any


class RecordingConn:
    def __init__(
        self,
        fetch_return: list[Any],
        responder: Callable[[str], list[Any]] | None = None,
    ) -> None:
        self.executed: list[str] = []
        self.fetched: list[tuple[str, tuple[Any, ...]]] = []
        self.txn_readonly: bool | None = None
        self._fetch_return = fetch_return
        self._responder = responder

    def transaction(self, *, readonly: bool = False) -> Any:
        self.txn_readonly = readonly

        class _Txn:
            async def __aenter__(self_: Any) -> None:
                return None

            async def __aexit__(self_: Any, *a: Any) -> None:
                return None

        return _Txn()

    async def execute(self, sql: str, *args: Any) -> None:
        self.executed.append(sql)

    async def fetch(self, sql: str, *args: Any) -> list[Any]:
        self.fetched.append((sql, args))
        if self._responder is not None:
            return self._responder(sql)
        return self._fetch_return


class RecordingPool:
    def __init__(
        self,
        fetch_return: list[Any] | None = None,
        responder: Callable[[str], list[Any]] | None = None,
    ) -> None:
        self.conn = RecordingConn(fetch_return or [], responder)

    def acquire(self) -> Any:
        conn = self.conn

        class _Acq:
            async def __aenter__(self_: Any) -> Any:
                return conn

            async def __aexit__(self_: Any, *a: Any) -> None:
                return None

        return _Acq()

    async def close(self) -> None:
        return None
