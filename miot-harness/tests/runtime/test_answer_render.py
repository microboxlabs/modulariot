import re
import xml.etree.ElementTree as ET

import yaml

from miot_harness.runtime.answer_render import render_answer, render_answer_with_format

MD = "# Title\n\nUse A & B when x < y"


def test_markdown_is_passthrough():
    assert render_answer(MD, "markdown") == MD


def test_unknown_format_returns_input_unchanged():
    assert render_answer(MD, "totally-bogus") == MD


def test_none_input_returns_none():
    assert render_answer(None, "html") is None


def test_html_renders_markdown_and_escapes():
    out = render_answer(MD, "html")
    assert "<h1>Title</h1>" in out
    assert "A &amp; B" in out
    assert "x &lt; y" in out


def test_plain_strips_markup_and_unescapes_entities():
    out = render_answer(MD, "plain")
    assert "Title" in out
    assert "Use A & B when x < y" in out
    assert not re.search(r"<[a-zA-Z/]", out) and "#" not in out


def test_yaml_round_trips_to_the_markdown_string():
    out = render_answer(MD, "yaml")
    assert yaml.safe_load(out) == {"answer": MD}


def test_xml_round_trips_to_the_markdown_string():
    out = render_answer(MD, "xml")
    root = ET.fromstring(out)
    assert root.tag == "answer"
    assert root.attrib == {"format": "markdown"}
    assert root.text == MD


def test_renderer_error_falls_back_to_raw_markdown(monkeypatch):
    import miot_harness.runtime.answer_render as mod

    def boom(_text):
        raise RuntimeError("kaboom")

    monkeypatch.setitem(mod._RENDERERS, "html", boom)
    assert render_answer(MD, "html") == MD


# --- render_answer_with_format tests ---


def test_render_answer_with_format_yaml_success():
    result, effective_fmt = render_answer_with_format(MD, "yaml")
    assert effective_fmt == "yaml"
    assert yaml.safe_load(result) == {"answer": MD}


def test_render_answer_with_format_html_success():
    result, effective_fmt = render_answer_with_format(MD, "html")
    assert effective_fmt == "html"
    assert "<h1>Title</h1>" in result


def test_render_answer_with_format_unknown_returns_markdown():
    result, effective_fmt = render_answer_with_format(MD, "totally-bogus")
    assert result == MD
    assert effective_fmt == "markdown"


def test_render_answer_with_format_renderer_error_returns_markdown(monkeypatch):
    import miot_harness.runtime.answer_render as mod

    def boom(_text):
        raise RuntimeError("kaboom")

    monkeypatch.setitem(mod._RENDERERS, "yaml", boom)
    result, effective_fmt = render_answer_with_format(MD, "yaml")
    assert result == MD
    assert effective_fmt == "markdown"


def test_render_answer_with_format_none_preserves_requested_fmt():
    result, effective_fmt = render_answer_with_format(None, "yaml")
    assert result is None
    assert effective_fmt == "yaml"
