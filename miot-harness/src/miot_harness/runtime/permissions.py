from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class PermissionDecision(StrEnum):
    ALLOW = "allow"
    ASK = "ask"
    DENY = "deny"


class PermissionResult(BaseModel):
    decision: PermissionDecision
    reason: str

    @classmethod
    def allow(cls, reason: str = "Read-only tool") -> "PermissionResult":
        return cls(decision=PermissionDecision.ALLOW, reason=reason)

    @classmethod
    def ask(cls, reason: str) -> "PermissionResult":
        return cls(decision=PermissionDecision.ASK, reason=reason)

    @classmethod
    def deny(cls, reason: str) -> "PermissionResult":
        return cls(decision=PermissionDecision.DENY, reason=reason)


class PermissionMode(StrEnum):
    """Run-level permission posture (Claude-Code-inspired).

    - DEFAULT: tool.check_permission decides; "ask" pauses for a human.
    - AUTO_SAFE: auto-approve non-destructive tools; destructive tools
      still pause (Claude Code's acceptEdits analog).
    - BYPASS: auto-approve everything (subject to the config policy gate
      resolved upstream in runtime/policy.py).
    """

    DEFAULT = "default"
    AUTO_SAFE = "auto_safe"
    BYPASS = "bypass"


class PermissionRule(BaseModel):
    """One allow/deny/ask rule, evaluated before a tool's own
    check_permission. `match` is an optional subset of the tool input that
    must be present (exact key/value equality) for the rule to apply.
    """

    tool: str
    decision: PermissionDecision
    match: dict[str, Any] | None = None


class PermissionPolicy(BaseModel):
    """The effective permission posture for a run: a mode plus an ordered
    rule list. Stored sticky per-conversation and plumbed onto HarnessContext.
    """

    mode: PermissionMode = PermissionMode.DEFAULT
    rules: list[PermissionRule] = Field(default_factory=list)


def evaluate_rules(
    rules: list[PermissionRule],
    *,
    tool_name: str,
    tool_input: dict[str, Any],
) -> PermissionDecision | None:
    """Return the decision of the first matching rule, or None if no rule
    matches. A rule matches when its `tool` equals `tool_name` and every
    key/value in its `match` is present and equal in `tool_input`.
    """

    for rule in rules:
        if rule.tool != tool_name:
            continue
        if rule.match and any(
            tool_input.get(k) != v for k, v in rule.match.items()
        ):
            continue
        return rule.decision
    return None
