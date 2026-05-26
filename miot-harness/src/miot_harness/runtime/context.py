from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

# The four explicit dispatch surfaces a caller can request. "auto" is the
# default (LLM intent router decides). The other three bypass the router
# and dispatch directly — useful for evals, cost-sensitive callers, and
# operator debugging.
RunMode = Literal["auto", "canned", "meta", "agentic"]


class HarnessContext(BaseModel):
    run_id: str = Field(default_factory=lambda: f"run_{uuid4().hex}")
    thread_id: str
    tenant_id: str
    user_id: str
    route_context: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    # Phase E (plan 13): the mode the caller requested. Set from
    # `UserRequest.mode` so per-mode cost can split in Langfuse panels.
    mode: RunMode = "auto"
    # Phase E10 (plan 13): the multi-turn conversation id, if any.
    # Used as the Langfuse `session_id` (falls back to `thread_id`).
    conversation_id: str | None = None
    # When true, the SSE stream carries full tool inputs and truncated
    # tool outputs (~2KB cap). Off by default; coordinador outputs
    # contain customer/fleet data that should not leak to unauthenticated
    # stream consumers.
    debug: bool = False


class UserRequest(BaseModel):
    message: str
    thread_id: str = "demo-thread"
    # Issue #522: `tenant_id` accepts a body value only as a legacy
    # affordance for the unauthenticated/dev path. When auth is
    # enabled, `api.server.require_auth` resolves the tenant from
    # the `X-Miot-Tenant-Client-Id` header set by the Quarkus proxy,
    # and `_apply_tenant_override` silently replaces the body value
    # in /runs and /runs:start before dispatch. R6 removes this field
    # entirely — do NOT build new logic that trusts the body value.
    tenant_id: str = "demo-tenant"
    user_id: str = "demo-user"
    route_context: dict[str, Any] = Field(default_factory=dict)
    mode: RunMode = "auto"
    conversation_id: str | None = None
    debug: bool = False

    def to_context(self) -> HarnessContext:
        return HarnessContext(
            thread_id=self.thread_id,
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            route_context=self.route_context,
            mode=self.mode,
            conversation_id=self.conversation_id,
            debug=self.debug,
        )
