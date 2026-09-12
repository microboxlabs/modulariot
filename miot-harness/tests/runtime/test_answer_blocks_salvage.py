"""Keeping a good answer a model narrated its way into.

Observed on the local stack, 2026-09-12: the loop wrote "Now I have all 13
rows. Let me compile the full list:", a draft table, and only then the block
array. The whole string was not JSON, so the fallback wrapped every character
of it — narration, draft and raw JSON — into one markdown block, and the chat
rendered that verbatim.
"""

import json

from miot_harness.runtime.answer_blocks import to_json_blocks


def _blocks(rendered: str) -> list[dict]:
    return json.loads(rendered)


def test_prose_before_the_array_is_dropped():
    raw = (
        "Now I have all 13 rows. Let me compile the full list:\n\n"
        "| Type | Name | Total |\n|---|---|---|\n| 5 | Speed Limit Standard | 24,482 |\n\n"
        + json.dumps(
            [
                {"type": "intent", "value": "ask"},
                {"type": "markdown", "value": "**Sintomas agosto 2026 - 57,975 en total**"},
                {
                    "type": "url",
                    "value": {"url": "/symptoms/symptoms-list", "name": "Ver sintomas"},
                },
            ]
        )
    )

    blocks = _blocks(to_json_blocks(raw))

    assert [b["type"] for b in blocks] == ["intent", "markdown", "url"]
    assert blocks[1]["value"] == "**Sintomas agosto 2026 - 57,975 en total**"
    assert "Let me compile" not in json.dumps(blocks)


def test_a_clean_answer_is_untouched():
    raw = json.dumps([{"type": "markdown", "value": "hi"}])

    assert _blocks(to_json_blocks(raw)) == [{"type": "markdown", "value": "hi"}]


def test_prose_after_the_array_still_falls_back():
    """Only a trailing array is a narrated answer. Anything after it means the
    model was doing something else, and guessing would lose that text."""

    raw = json.dumps([{"type": "markdown", "value": "hi"}]) + "\n\nhope that helps!"

    blocks = _blocks(to_json_blocks(raw))

    assert len(blocks) == 1
    assert blocks[0]["value"] == raw


def test_a_trailing_array_that_is_not_blocks_falls_back():
    raw = "the counts were [1, 2, 3]"

    blocks = _blocks(to_json_blocks(raw))

    assert blocks == [{"type": "markdown", "value": raw}]


def test_a_markdown_link_before_the_array_does_not_derail_the_scan():
    """`[` appears in prose long before the real array. The scan has to walk
    past it rather than stop at the first bracket."""

    raw = "see [the list](http://x/y) below:\n" + json.dumps(
        [{"type": "markdown", "value": "done"}]
    )

    blocks = _blocks(to_json_blocks(raw))

    assert blocks == [{"type": "markdown", "value": "done"}]


def test_an_array_nested_in_a_block_value_is_not_mistaken_for_the_answer():
    """A block whose value quotes a JSON array ends before the text does, so
    the widest array — the real one — is the one kept."""

    inner = json.dumps([{"type": "markdown", "value": "example"}])
    raw = "here you go:\n" + json.dumps(
        [{"type": "markdown", "value": f"an answer looks like {inner}"}]
    )

    blocks = _blocks(to_json_blocks(raw))

    assert len(blocks) == 1
    assert blocks[0]["value"].startswith("an answer looks like")


def test_unparseable_text_still_becomes_one_markdown_block():
    raw = "no array here at all"

    assert _blocks(to_json_blocks(raw)) == [{"type": "markdown", "value": raw}]
