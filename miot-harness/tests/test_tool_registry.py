from miot_harness.tools.registry import build_default_registry


def test_default_registry_contains_first_slice_tools() -> None:
    registry = build_default_registry()

    assert registry.names() == [
        "apply_dashboard_patch",
        "create_dashboard_widget_draft",
        "create_story_draft",
        "get_dashboard_context",
        "get_delivery_compliance_metrics",
        "get_workflow_bottlenecks",
    ]
