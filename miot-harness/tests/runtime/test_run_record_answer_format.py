from miot_harness.runtime.run_store import HarnessRunRecord


def test_record_defaults_answer_format_to_markdown():
    rec = HarnessRunRecord(run_id="run_x")
    assert rec.answer_format == "markdown"


def test_legacy_record_without_answer_format_still_loads():
    # Pre-existing persisted JSON has no answer_format key.
    rec = HarnessRunRecord.model_validate({"run_id": "run_x", "answer": "hi"})
    assert rec.answer_format == "markdown"
    assert rec.answer == "hi"
