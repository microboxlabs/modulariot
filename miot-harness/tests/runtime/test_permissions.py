from __future__ import annotations

from miot_harness.runtime.permissions import (
    PermissionDecision,
    PermissionMode,
    PermissionPolicy,
    PermissionRule,
    evaluate_rules,
)


def test_default_policy_is_default_mode_no_rules() -> None:
    policy = PermissionPolicy()
    assert policy.mode is PermissionMode.DEFAULT
    assert policy.rules == []


def test_evaluate_rules_returns_none_when_no_match() -> None:
    rules = [PermissionRule(tool="run_sql", decision=PermissionDecision.ALLOW)]
    assert evaluate_rules(rules, tool_name="other_tool", tool_input={}) is None


def test_allow_rule_matches_by_tool_name() -> None:
    rules = [PermissionRule(tool="run_sql", decision=PermissionDecision.ALLOW)]
    result = evaluate_rules(rules, tool_name="run_sql", tool_input={})
    assert result is PermissionDecision.ALLOW


def test_deny_rule_wins_over_later_allow() -> None:
    rules = [
        PermissionRule(tool="run_sql", decision=PermissionDecision.DENY),
        PermissionRule(tool="run_sql", decision=PermissionDecision.ALLOW),
    ]
    assert evaluate_rules(rules, tool_name="run_sql", tool_input={}) is (
        PermissionDecision.DENY
    )


def test_rule_match_on_input_key_value() -> None:
    rules = [
        PermissionRule(
            tool="run_sql",
            decision=PermissionDecision.ALLOW,
            match={"table": "fleet_status"},
        )
    ]
    assert (
        evaluate_rules(
            rules, tool_name="run_sql", tool_input={"table": "fleet_status"}
        )
        is PermissionDecision.ALLOW
    )
    assert (
        evaluate_rules(rules, tool_name="run_sql", tool_input={"table": "other"})
        is None
    )
