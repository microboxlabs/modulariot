import re
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from miot_harness.runtime.approvals import ApprovalRegistry
from miot_harness.runtime.permissions import (
    PermissionMode,
    PermissionPolicy,
    PermissionRule,
)

# The four explicit dispatch surfaces a caller can request. "auto" is the
# default (LLM intent router decides). The other three bypass the router
# and dispatch directly — useful for evals, cost-sensitive callers, and
# operator debugging.
RunMode = Literal["auto", "canned", "meta", "agentic"]

# The output format for the run's `answer` string. The JSON response envelope
# never changes; only the encoding of `answer` does. "markdown" is canonical
# (what the agents emit) and the default when a caller omits the field.
AnswerFormat = Literal["markdown", "plain", "html", "xml", "yaml", "json"]

# A leading "/slug" in a request message selects a skill (e.g.
# "/fleet-report how is the fleet?"). The slug must be followed by whitespace
# or end-of-string, so path-like text ("/runs/status") is not matched.
_SKILL_SLUG_RE = re.compile(r"^/(?P<slug>[A-Za-z0-9_-]+)(?:\s+(?P<rest>.*))?$", re.DOTALL)


class HarnessContext(BaseModel):
    # ApprovalRegistry is a process-local handle, not a serializable
    # field — needs arbitrary_types_allowed + manual exclude on dump.
    model_config = ConfigDict(arbitrary_types_allowed=True)

    run_id: str = Field(default_factory=lambda: f"run_{uuid4().hex}")
    thread_id: str
    tenant_id: str
    user_id: str
    route_context: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    # Phase E (plan 13): the mode the caller requested. Set from
    # `UserRequest.mode` so per-mode cost can split in Langfuse panels.
    mode: RunMode = "auto"
    # The caller-requested output format for the final answer string. Read by
    # HarnessSupervisor._finalize_answer to render record.answer before save.
    answer_format: AnswerFormat = "markdown"
    # Phase E10 (plan 13): the multi-turn conversation id, if any.
    # Used as the Langfuse `session_id` (falls back to `thread_id`).
    conversation_id: str | None = None
    # When true, the SSE stream carries full tool inputs and truncated
    # tool outputs (~2KB cap). Off by default; datasource tool outputs
    # contain customer/fleet data that should not leak to unauthenticated
    # stream consumers.
    debug: bool = False
    # Plan 07 gap 3: per-run handle to the in-process approval registry.
    # The API layer injects this from app.state; CLI/eval paths leave it
    # None and the tool layer treats "ask" as deny when it's unset.
    approval_registry: ApprovalRegistry | None = Field(default=None, exclude=True)
    # Steering Plan A: the resolved permission posture for this run
    # (mode + rules), set by the supervisor after the bypass gate. Like
    # approval_registry, it is excluded from model_dump (PermissionPolicy
    # is serializable, but it is run-control state, not run output).
    permission_policy: PermissionPolicy | None = Field(default=None, exclude=True)


class UserRequest(BaseModel):
    message: str
    thread_id: str = "demo-thread"
    # Issue #522 R6: `tenant_id` and `user_id` are deprecated body
    # fields. In production the tenant is set in `api.server` from the
    # trusted `X-Miot-Tenant-Client-Id` header (Quarkus proxy); the
    # body value is only an auth-disabled dev/test escape hatch.
    #
    # `tenant_id` has NO default. A run with no resolved tenant — no
    # header and no explicit body value — is rejected at the API
    # boundary (400) rather than silently attributed to a placeholder:
    # a missing tenant means the request bypassed the org proxy, which
    # is a misconfiguration, not a valid anonymous run. Do NOT build
    # new logic that trusts these values.
    tenant_id: str | None = Field(
        default=None,
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
    # Optional skill to activate for this run. When set and resolvable,
    # the supervisor injects that skill's SKILL.md body as run guidance so
    # the agent follows it (the invocation half of skills). Unknown ids are
    # ignored — the run proceeds normally.
    skill_id: str | None = None
    # Steering Plan A: optional permission posture supplied by the caller.
    # When omitted, the supervisor falls back to the sticky conversation
    # policy, then the tenant default.
    permission_mode: PermissionMode | None = None
    rules: list[PermissionRule] = Field(default_factory=list)
    # Output format for the response `answer` string (default markdown).
    answer_format: AnswerFormat = "markdown"

    @field_validator("tenant_id")
    @classmethod
    def _normalize_tenant_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @model_validator(mode="after")
    def _extract_skill_slug(self) -> "UserRequest":
        """Pull a leading "/slug" out of `message` into `skill_id` when empty.

        An explicit `skill_id` always wins (message left untouched). Unknown
        slugs resolve to no skill downstream and the run proceeds normally.
        """
        if not self.skill_id:
            match = _SKILL_SLUG_RE.match(self.message)
            if match is not None:
                self.skill_id = match.group("slug")
                self.message = match.group("rest") or ""
        return self

    def to_context(self) -> HarnessContext:
        # A HarnessContext requires a concrete tenant. The API rejects
        # unresolved tenants (400) before reaching here; this guard turns a
        # direct caller's mistake into a clear error instead of an opaque
        # pydantic ValidationError on HarnessContext.tenant_id.
        tenant_id = self.tenant_id
        if not tenant_id:
            raise ValueError(
                "UserRequest.tenant_id is unresolved; a run requires a tenant "
                "(from the X-Miot-Tenant-Client-Id header or an explicit body value)"
            )
        # NOTE: the policy built here is UNGATED — the bypass policy gate
        # (resolve_effective_mode) is NOT applied. HarnessSupervisor.run
        # overwrites ctx.permission_policy with the gated result of
        # _resolve_policy, so this value is only a seed. Any caller that
        # uses to_context() outside the supervisor and then drives a tool
        # directly MUST apply the gate itself, or a bypass mode will skip it.
        policy: PermissionPolicy | None = None
        if self.permission_mode is not None or self.rules:
            policy = PermissionPolicy(
                mode=self.permission_mode or PermissionMode.DEFAULT,
                rules=list(self.rules),
            )
        return HarnessContext(
            thread_id=self.thread_id,
            tenant_id=tenant_id,
            user_id=self.user_id,
            route_context=self.route_context,
            mode=self.mode,
            conversation_id=self.conversation_id,
            debug=self.debug,
            answer_format=self.answer_format,
            permission_policy=policy,
        )
