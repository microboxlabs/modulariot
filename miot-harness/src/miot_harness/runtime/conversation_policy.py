"""Sticky per-conversation permission policy (Steering Plan A).

Mirrors the InMemoryConversationStore pattern: a Protocol so a v2 Redis
implementation drops in, and an in-memory dict keyed by conversation_id
for v1. Lost on process restart — acceptable for v1.
"""

from __future__ import annotations

from typing import Protocol

from miot_harness.runtime.permissions import PermissionPolicy


class ConversationPolicyStore(Protocol):
    def get(self, conversation_id: str) -> PermissionPolicy | None: ...

    def set(self, conversation_id: str, policy: PermissionPolicy) -> None: ...


class InMemoryConversationPolicyStore:
    """Dict-keyed in-memory policy store. Single event loop, no locks."""

    def __init__(self) -> None:
        self._policies: dict[str, PermissionPolicy] = {}

    def get(self, conversation_id: str) -> PermissionPolicy | None:
        return self._policies.get(conversation_id)

    def set(self, conversation_id: str, policy: PermissionPolicy) -> None:
        self._policies[conversation_id] = policy
