import pytest
from pydantic import ValidationError

from miot_harness.runtime.context import UserRequest


def test_answer_format_accepts_json():
    assert UserRequest(message="hi", answer_format="json").answer_format == "json"


def test_answer_format_still_rejects_invalid():
    with pytest.raises(ValidationError):
        UserRequest(message="hi", answer_format="pdf")


def test_leading_slug_sets_skill_id_and_strips_message():
    req = UserRequest(message="/fleet-report how is the fleet?")
    assert req.skill_id == "fleet-report"
    assert req.message == "how is the fleet?"


def test_slug_only_message_leaves_empty_message():
    req = UserRequest(message="/fleet-report")
    assert req.skill_id == "fleet-report"
    assert req.message == ""


def test_explicit_skill_id_wins_over_slug():
    req = UserRequest(message="/other do it", skill_id="explicit")
    assert req.skill_id == "explicit"
    assert req.message == "/other do it"  # message untouched when skill_id present


def test_non_slug_message_is_untouched():
    req = UserRequest(message="how is the fleet?")
    assert req.skill_id is None
    assert req.message == "how is the fleet?"


def test_path_like_message_is_not_treated_as_slug():
    # "/runs/status" has no whitespace boundary after the first segment.
    req = UserRequest(message="/runs/status please")
    assert req.skill_id is None
    assert req.message == "/runs/status please"
