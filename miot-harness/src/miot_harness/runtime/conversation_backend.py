"""Durable storage for conversation memory.

`InMemoryConversationStore` keeps conversations in process memory. With a
backend it also saves each conversation after a run and loads one it does not
hold, so a restart or deploy keeps every turn, its tool calls and results, and
the summary.

`ModulithConversationBackend` stores them through the modulith's
`/internal/harness-conversations`. Any service with the same two calls can
stand in for it.
"""

from __future__ import annotations

from typing import Any, Protocol

import httpx
from langchain_core.messages import messages_from_dict, messages_to_dict

from miot_harness.runtime.conversation import ConversationHistory, ConversationTurn

_PATH = "/internal/harness-conversations"
_KEY_HEADER = "x-miot-harness-key"
_VERSION = 1


class ConversationBackend(Protocol):
    async def load(self, key: str, *, tenant_id: str) -> dict[str, Any] | None: ...

    async def save(self, key: str, doc: dict[str, Any], *, meta: dict[str, str | None]) -> None: ...


def history_to_doc(history: ConversationHistory) -> dict[str, Any]:
    return {
        "version": _VERSION,
        "summary": history.summary,
        "turns": [
            {
                "user_message": turn.user_message,
                "assistant_answer": turn.assistant_answer,
                "messages": messages_to_dict(list(turn.messages)),
            }
            for turn in history.turns
        ],
    }


def doc_to_history(key: str, doc: dict[str, Any]) -> ConversationHistory:
    turns = [
        ConversationTurn(
            user_message=str(turn.get("user_message") or ""),
            assistant_answer=str(turn.get("assistant_answer") or ""),
            messages=tuple(messages_from_dict(turn.get("messages") or [])),
        )
        for turn in doc.get("turns") or []
    ]
    summary = doc.get("summary")
    return ConversationHistory(
        conversation_id=key,
        turns=turns,
        summary=summary if isinstance(summary, str) and summary else None,
    )


class ModulithConversationBackend:
    def __init__(
        self,
        modulith_url: str,
        key: str,
        *,
        timeout: float = 10.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._url = modulith_url.rstrip("/") + _PATH
        self._headers = {_KEY_HEADER: key}
        self._timeout = timeout
        self._transport = transport

    async def load(self, key: str, *, tenant_id: str) -> dict[str, Any] | None:
        params = {"key": key, "tenantId": tenant_id}
        async with httpx.AsyncClient(transport=self._transport, timeout=self._timeout) as client:
            response = await client.get(self._url, params=params, headers=self._headers)
        if response.status_code == 404:
            return None
        response.raise_for_status()
        memory = response.json().get("memory")
        return memory if isinstance(memory, dict) else None

    async def save(self, key: str, doc: dict[str, Any], *, meta: dict[str, str | None]) -> None:
        body = {"key": key, "memory": doc, **meta}
        async with httpx.AsyncClient(transport=self._transport, timeout=self._timeout) as client:
            response = await client.put(self._url, json=body, headers=self._headers)
        response.raise_for_status()
