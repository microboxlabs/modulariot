from __future__ import annotations

from miot_harness.config import HarnessSettings
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.conversation_policy import InMemoryConversationPolicyStore
from miot_harness.runtime.permissions import PermissionMode, PermissionPolicy
from miot_harness.runtime.supervisor import HarnessSupervisor


def _resolve(
    supervisor: HarnessSupervisor, request: UserRequest, *, env: str
) -> tuple[PermissionPolicy, bool]:
    settings = HarnessSettings(datasource_dsn=None, env=env)  # type: ignore[arg-type]
    return supervisor._resolve_policy(request, settings=settings)


def _supervisor(**kw: object) -> HarnessSupervisor:
    import tempfile
    from pathlib import Path

    from miot_harness.runtime.router import IntentRouter
    from miot_harness.runtime.run_store import JsonRunStore
    from miot_harness.storytelling.module import StorytellingModule
    from miot_harness.tools.registry import ToolRegistry

    return HarnessSupervisor(
        router=IntentRouter(),
        tools=ToolRegistry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(Path(tempfile.mkdtemp())),
        **kw,
    )


def test_request_bypass_downgraded_in_prod_sets_denied_flag() -> None:
    sup = _supervisor()
    req = UserRequest(message="hi", permission_mode=PermissionMode.BYPASS)
    policy, denied = _resolve(sup, req, env="prod")
    assert policy.mode is PermissionMode.DEFAULT
    assert denied is True


def test_sticky_policy_reused_when_request_omits_mode() -> None:
    from miot_harness.runtime.permissions import PermissionDecision, PermissionRule

    store = InMemoryConversationPolicyStore()
    sup = _supervisor(conversation_policy_store=store)
    first = UserRequest(
        message="hi",
        conversation_id="c1",
        permission_mode=PermissionMode.AUTO_SAFE,
        rules=[PermissionRule(tool="run_sql", decision=PermissionDecision.ALLOW)],
    )
    sup._resolve_policy(first, settings=HarnessSettings(datasource_dsn=None, env="local"))  # type: ignore[arg-type]
    second = UserRequest(message="again", conversation_id="c1")  # no mode/rules
    policy, _ = sup._resolve_policy(
        second, settings=HarnessSettings(datasource_dsn=None, env="local")  # type: ignore[arg-type]
    )
    assert policy.mode is PermissionMode.AUTO_SAFE
    assert policy.rules[0].tool == "run_sql"
