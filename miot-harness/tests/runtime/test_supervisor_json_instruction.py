from langchain_core.messages import SystemMessage

from miot_harness.runtime.supervisor import HarnessSupervisor


def _ctx(fmt):
    class _C:
        answer_format = fmt

    return _C()


def test_injects_instruction_when_format_is_json():
    sup = object.__new__(HarnessSupervisor)
    out = sup._inject_json_blocks_instruction(_ctx("json"), [])
    assert len(out) == 1
    assert isinstance(out[0], SystemMessage)
    assert "JSON array" in out[0].content


def test_no_injection_for_other_formats():
    sup = object.__new__(HarnessSupervisor)
    existing = ["x"]
    assert sup._inject_json_blocks_instruction(_ctx("markdown"), existing) == existing


def test_instruction_is_prepended_before_existing_messages():
    sup = object.__new__(HarnessSupervisor)
    existing = [SystemMessage(content="skill body")]
    out = sup._inject_json_blocks_instruction(_ctx("json"), existing)
    assert out[0].content != "skill body"  # json instruction is first
    assert out[1].content == "skill body"
