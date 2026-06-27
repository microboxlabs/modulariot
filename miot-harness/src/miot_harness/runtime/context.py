from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field

from miot_harness.runtime.approvals import ApprovalRegistry
from miot_harness.runtime.permissions import (
    PermissionMode,
    PermissionPolicy,
    PermissionRule,
)
from miot_harness.runtime.steering import SteeringRegistry

# The four explicit dispatch surfaces a caller can request. "auto" is the
# default (LLM intent router decides). The other three bypass the router
# and dispatch directly — useful for evals, cost-sensitive callers, and
# operator debugging.
RunMode = Literal["auto", "canned", "meta", "agentic"]


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
    # Steering Plan C: per-run handle to the in-process live-steering
    # channel. The supervisor opens the channel at run start and injects
    # this handle so the agentic planner boundary can drain operator notes
    # and poll the cooperative interrupt flag. Excluded from model_dump
    # (process-local, not run output), like approval_registry.
    steering_registry: SteeringRegistry | None = Field(default=None, exclude=True)
    # Steering Plan A: the resolved permission posture for this run
    # (mode + rules), set by the supervisor after the bypass gate. Like
    # approval_registry, it is excluded from model_dump (PermissionPolicy
    # is serializable, but it is run-control state, not run output).
    permission_policy: PermissionPolicy | None = Field(default=None, exclude=True)

    async def request_choice(
        self,
        prompt: str,
        *,
        options: list[dict[str, Any]],
        progress: Callable[[Any], None],
    ) -> str | None:
        """Surface an agent decision point and block until a human chooses.

        Registers a `choice` decision on the run-control registry, emits
        `decision.requested` (kind=choice) carrying the options, awaits the
        resolution, emits `decision.resolved`, and returns the chosen
        option_id. Returns None when no registry is wired (CLI/eval) so
        callers can fall back to a default.
        """
        from miot_harness.runtime.events import HarnessEvent

        registry = self.approval_registry
        if registry is None:
            return None
        decision_id = uuid4().hex
        progress(
            HarnessEvent(
                run_id=self.run_id,
                type="decision.requested",
                message=prompt,
                data={"decision_id": decision_id, "kind": "choice", "options": options},
            )
        )
        event = registry.register(decision_id, self.run_id, kind="choice")
        try:
            await event.wait()
            resolution = registry.decision(decision_id)
        finally:
            registry.discard(decision_id)
        progress(
            HarnessEvent(
                run_id=self.run_id,
                type="decision.resolved",
                message=f"decision {decision_id} resolved",
                data={
                    "decision_id": decision_id,
                    "action": resolution.action if resolution else "deny",
                },
            )
        )
        if resolution is None or resolution.action != "choose":
            return None
        return resolution.option_id


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

    def to_context(self) -> HarnessContext:
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
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            route_context=self.route_context,
            mode=self.mode,
            conversation_id=self.conversation_id,
            debug=self.debug,
            permission_policy=policy,
        )
