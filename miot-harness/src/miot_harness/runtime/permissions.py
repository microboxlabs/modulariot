from enum import StrEnum

from pydantic import BaseModel


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
