import pytest
from pydantic import ValidationError

from miot_harness.runtime.context import UserRequest


def test_answer_format_defaults_to_markdown():
    req = UserRequest(message="hi")
    assert req.answer_format == "markdown"


@pytest.mark.parametrize("fmt", ["markdown", "plain", "html", "xml", "yaml"])
def test_answer_format_accepts_valid_values(fmt):
    assert UserRequest(message="hi", answer_format=fmt).answer_format == fmt


def test_answer_format_rejects_invalid_value():
    with pytest.raises(ValidationError):
        UserRequest(message="hi", answer_format="pdf")


def test_to_context_carries_answer_format():
    ctx = UserRequest(message="hi", answer_format="yaml").to_context()
    assert ctx.answer_format == "yaml"
