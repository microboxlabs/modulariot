"""Report the tokens each run used to the modulith, which charges the organization.

The run's `usage.recorded` events are summed per provider and model and posted
to `/internal/model-usage` once the run ends, whether it completed, failed or
was cancelled. The modulith ignores a repeated report for the same run, so a
failed post is retried.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Iterable
from typing import Any

import httpx

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.run_store import HarnessRunRecord

logger = logging.getLogger(__name__)

_PATH = "/internal/model-usage"
_KEY_HEADER = "x-miot-harness-key"


def usage_lines(events: Iterable[HarnessEvent]) -> list[dict[str, Any]]:
    """Token totals per provider and model. Calls with no provider are skipped."""
    totals: dict[tuple[str, str], dict[str, Any]] = {}
    for event in events:
        if event.type != "usage.recorded":
            continue
        data = event.data
        provider, model = data.get("provider"), data.get("model")
        if not provider or not model:
            continue
        line = totals.setdefault(
            (provider, model),
            {
                "provider": provider,
                "model": model,
                "calls": 0,
                "inputTokens": 0,
                "outputTokens": 0,
                "cacheReadTokens": 0,
                "cacheWriteTokens": 0,
            },
        )
        line["calls"] += 1
        line["inputTokens"] += int(data.get("input_tokens") or 0)
        line["outputTokens"] += int(data.get("output_tokens") or 0)
        line["cacheReadTokens"] += int(data.get("cache_read_input_tokens") or 0)
        line["cacheWriteTokens"] += int(data.get("cache_creation_input_tokens") or 0)
    return list(totals.values())


class UsageReporter:
    """Posts each finished run's usage in the background.

    `report` never raises and never delays the run. `drain` waits for posts
    still in flight, for shutdown.
    """

    def __init__(
        self,
        modulith_url: str,
        key: str,
        *,
        attempts: int = 3,
        backoff_seconds: float = 1.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._url = modulith_url.rstrip("/") + _PATH
        self._key = key
        self._attempts = attempts
        self._backoff = backoff_seconds
        self._client = client
        self._pending: set[asyncio.Task[bool]] = set()

    def report(self, record: HarnessRunRecord, ctx: HarnessContext) -> None:
        lines = usage_lines(record.events)
        if not lines:
            return
        payload = {
            "runId": record.run_id,
            "organization": ctx.organization,
            "tenantId": ctx.tenant_id,
            "userId": ctx.user_id,
            "usage": lines,
        }
        task = asyncio.get_running_loop().create_task(self.send(payload))
        self._pending.add(task)
        task.add_done_callback(self._pending.discard)

    async def send(self, payload: dict[str, Any]) -> bool:
        for attempt in range(1, self._attempts + 1):
            try:
                await self._post(payload)
                return True
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code < 500:
                    # A refused key or a bad body will not get better on retry.
                    break
                logger.warning(
                    "usage report for %s: attempt %d got %s",
                    payload["runId"],
                    attempt,
                    exc.response.status_code,
                )
            except httpx.HTTPError as exc:
                logger.warning(
                    "usage report for %s: attempt %d failed: %s", payload["runId"], attempt, exc
                )
            if attempt < self._attempts:
                await asyncio.sleep(self._backoff * attempt)
        logger.error(
            "usage report for run %s was not recorded: %s", payload["runId"], payload["usage"]
        )
        return False

    async def drain(self, timeout: float = 10.0) -> None:
        if self._pending:
            await asyncio.wait(set(self._pending), timeout=timeout)

    async def _post(self, payload: dict[str, Any]) -> None:
        headers = {_KEY_HEADER: self._key}
        if self._client is not None:
            response = await self._client.post(self._url, json=payload, headers=headers)
        else:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(self._url, json=payload, headers=headers)
        response.raise_for_status()
