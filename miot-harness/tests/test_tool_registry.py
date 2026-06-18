from miot_harness.config import HarnessSettings
from miot_harness.tools.registry import build_default_registry


def test_default_registry_contains_first_slice_tools() -> None:
    # fs_* scratchpad tools are on by default (fs_enabled=True).
    registry = build_default_registry()

    assert registry.names() == [
        "apply_dashboard_patch",
        "create_dashboard_widget_draft",
        "create_story_draft",
        "fs_edit",
        "fs_ls",
        "fs_read",
        "fs_write",
        "get_dashboard_context",
        "get_delivery_compliance_metrics",
        "get_workflow_bottlenecks",
    ]


def test_default_registry_omits_fs_tools_when_disabled() -> None:
    registry = build_default_registry(HarnessSettings(fs_enabled=False))

    assert registry.names() == [
        "apply_dashboard_patch",
        "create_dashboard_widget_draft",
        "create_story_draft",
        "get_dashboard_context",
        "get_delivery_compliance_metrics",
        "get_workflow_bottlenecks",
    ]
