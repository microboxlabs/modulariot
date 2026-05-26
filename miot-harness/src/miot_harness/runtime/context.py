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
    # Issue #522 R6: `tenant_id` and `user_id` are deprecated body
    # fields. In production they are silently overridden in
    # `api.server` from the `X-Miot-Tenant-Client-Id` header set by
    # the Quarkus proxy — `api.server.require_auth` makes the header
    # mandatory whenever `MIOT_HARNESS_AUTH_ENABLED=true`, so body
    # values are inert in any deployment that has auth on. They
    # remain on the schema only to keep the CLI demo, eval harness,
    # and the existing unit-test fleet (~30 call sites) working
    # while the dev escape hatch is being phased out. A follow-up
    # release will remove both fields once staging soak confirms no
    # remaining caller relies on them. Do NOT build new logic that
    # trusts these values.
    tenant_id: str = Field(
        default="demo-tenant",
        json_schema_extra={"deprecated": True},
    )
    user_id: str = Field(
        default="demo-user",
        json_schema_extra={"deprecated": True},
    )
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
