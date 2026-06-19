from __future__ import annotations

from miot_harness.runtime.conversation_policy import InMemoryConversationPolicyStore
from miot_harness.runtime.permissions import PermissionMode, PermissionPolicy


def test_get_unknown_returns_none() -> None:
    store = InMemoryConversationPolicyStore()
    assert store.get("conv-1") is None


def test_set_then_get_roundtrips() -> None:
    store = InMemoryConversationPolicyStore()
    policy = PermissionPolicy(mode=PermissionMode.BYPASS)
    store.set("conv-1", policy)
    fetched = store.get("conv-1")
    assert fetched is not None
    assert fetched.mode is PermissionMode.BYPASS


def test_set_overwrites_prior_policy() -> None:
    store = InMemoryConversationPolicyStore()
    store.set("conv-1", PermissionPolicy(mode=PermissionMode.BYPASS))
    store.set("conv-1", PermissionPolicy(mode=PermissionMode.AUTO_SAFE))
    fetched = store.get("conv-1")
    assert fetched is not None
    assert fetched.mode is PermissionMode.AUTO_SAFE
