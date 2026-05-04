import pytest

from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.factory import build_harness


@pytest.mark.asyncio
async def test_delivery_compliance_story_run_creates_story_artifact(tmp_path) -> None:
    harness = build_harness(tmp_path)

    record = await harness.run(
        UserRequest(
            message=(
                "Tell me the story of delivery compliance this month "
                "and suggest one dashboard widget."
            )
        )
    )

    assert record.status == "completed"
    assert record.artifacts
    assert record.artifacts[0]["title"] == "Delivery Compliance This Month"
    assert record.artifacts[0]["widget_drafts"][0]["title"] == "Delivery Compliance This Month"
