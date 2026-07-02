import json

import pytest

from miot_harness.runtime.answer_blocks import (
    AnswerBlock,
    parse_blocks,
    to_json_blocks,
)


def test_parse_clean_array_of_known_blocks():
    raw = json.dumps([
        {"type": "markdown", "value": "hello **world**"},
        {"type": "url", "value": {"url": "https://x.com", "name": "X"}},
    ])
    blocks = parse_blocks(raw)
    assert [b.type for b in blocks] == ["markdown", "url"]
    assert blocks[1].value == {"url": "https://x.com", "name": "X"}


def test_parse_strips_json_code_fence():
    raw = '```json\n[{"type": "markdown", "value": "hi"}]\n```'
    blocks = parse_blocks(raw)
    assert blocks[0].value == "hi"


def test_parse_strips_bare_code_fence():
    raw = '```\n[{"type": "markdown", "value": "hi"}]\n```'
    blocks = parse_blocks(raw)
    assert blocks[0].value == "hi"


def test_parse_allows_unknown_type_passthrough():
    raw = json.dumps([{"type": "chart", "value": {"series": [1, 2, 3]}}])
    blocks = parse_blocks(raw)
    assert blocks[0].type == "chart"
    assert blocks[0].value == {"series": [1, 2, 3]}


def test_parse_rejects_non_array():
    with pytest.raises(ValueError):
        parse_blocks('{"type": "markdown", "value": "hi"}')


def test_parse_rejects_non_json():
    with pytest.raises(ValueError):
        parse_blocks("just some prose, not json")


def test_parse_rejects_markdown_block_with_non_string_value():
    with pytest.raises(ValueError):
        parse_blocks(json.dumps([{"type": "markdown", "value": {"oops": 1}}]))


def test_parse_rejects_url_block_missing_name():
    with pytest.raises(ValueError):
        parse_blocks(json.dumps([{"type": "url", "value": {"url": "https://x.com"}}]))


def test_parse_rejects_url_block_missing_url():
    with pytest.raises(ValueError):
        parse_blocks(json.dumps([{"type": "url", "value": {"name": "X"}}]))


def test_to_json_blocks_roundtrips_valid_input():
    raw = json.dumps([{"type": "markdown", "value": "hi"}])
    out = to_json_blocks(raw)
    assert json.loads(out) == [{"type": "markdown", "value": "hi"}]


def test_to_json_blocks_falls_back_to_single_markdown_block():
    out = to_json_blocks("not json at all")
    assert json.loads(out) == [{"type": "markdown", "value": "not json at all"}]


def test_answer_block_model_validates_known_types_directly():
    AnswerBlock(type="markdown", value="ok")  # no raise
    with pytest.raises(ValueError):
        AnswerBlock(type="url", value="not-an-object")
