"""BPMN parsing and the Mermaid/SVG renderings drawn from it."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from miot_harness.integrations.generic_pg import bpmn

FIXTURE = Path(__file__).parents[2] / "fixtures" / "bpmn" / "request_review.bpmn20.xml"


@pytest.fixture
def xml() -> bytes:
    return FIXTURE.read_bytes()


@pytest.fixture
def graph(xml: bytes) -> bpmn.ProcessGraph:
    return bpmn.parse_bpmn(xml, "requestReview")


def _no_layout(xml: bytes) -> bytes:
    return re.sub(rb"<bpmndi:BPMNDiagram.*</bpmndi:BPMNDiagram>", b"", xml, flags=re.S)


def test_nodes_carry_type_name_form_and_lane(graph: bpmn.ProcessGraph) -> None:
    assert (graph.process_id, graph.name) == ("requestReview", "Request review")
    assert len(graph.nodes) == 13
    assert len(graph.edges) == 14
    register = graph.node("register")
    assert register is not None
    assert (register.type, register.name, register.form_key, register.lane) == (
        "userTask",
        "Register request",
        "wf:registerTask",
        "Front office",
    )
    assert [n.id for n in graph.nodes if n.type == "endEvent"] == [
        "rejected",
        "completed",
        "cancelled",
    ]
    assert [n.type for n in graph.nodes].count("parallelGateway") == 2


def test_edges_carry_conditions_defaults_and_back_edges(graph: bpmn.ProcessGraph) -> None:
    by_id = {e.id: e for e in graph.edges}
    assert by_id["f3"].condition == "${outcome=='Approve'}"
    assert by_id["f13"].default
    assert [e.id for e in graph.edges if e.back] == ["f6"]
    assert by_id["f3"].waypoints[0] == (350.0, 98.0)


def test_json_is_compact(graph: bpmn.ProcessGraph) -> None:
    shape = graph.to_json()
    assert shape["nodes"][5] == {"id": "split", "type": "parallelGateway", "lane": "Back office"}
    assert {"from": "revise", "to": "register", "back": True} in shape["edges"]
    assert {
        "from": "decide",
        "to": "rejected",
        "condition": "${outcome=='Reject'}",
    } in shape["edges"]


def test_short_condition() -> None:
    assert bpmn.short_condition("${outcome=='Needs changes'}") == "Needs changes"
    assert bpmn.short_condition('${state == "open"}') == "open"
    assert bpmn.short_condition("${amount > 1000 && urgent}") == "amount > 1000 && urgent"
    assert bpmn.short_condition("${" + "x" * 80 + "}", 10) == "x" * 9 + "…"


def test_mermaid_flowchart(graph: bpmn.ProcessGraph) -> None:
    text = bpmn.to_mermaid(graph)
    lines = text.splitlines()
    assert lines[0] == "flowchart LR"
    assert '  n0(("Start"))' in lines
    assert '  n2{"Outcome?"}' in lines
    assert '  n2 -->|"Approve"| n5' in lines
    assert "  n3 -.-> n1" in lines
    assert '  n10 -->|"default"| n11' in lines


def test_mermaid_escapes_labels(xml: bytes) -> None:
    hostile = xml.replace(b'name="Register request"', b'name="A &quot;b&quot; | &lt;c&gt;"')
    text = bpmn.to_mermaid(bpmn.parse_bpmn(hostile))
    assert '  n1["A #quot;b#quot; #124; #lt;c#gt;"]' in text.splitlines()


def test_svg_draws_the_saved_layout(graph: bpmn.ProcessGraph) -> None:
    svg = bpmn.to_svg(graph, title="Request review")
    assert svg is not None
    assert svg.startswith("<svg ")
    assert svg.count("<rect ") == 3 + 5  # background, two lanes, five tasks
    assert svg.count("<polygon ") == 4  # gateways
    assert svg.count("<circle ") == 4  # events
    assert svg.count("<polyline ") == 14
    assert svg.count('stroke-dasharray="5 4"') == 1  # the loop back
    assert ">Needs changes<" in svg
    assert ">Front office<" in svg
    bpmn.check_svg(svg)


def test_svg_heat_colors_and_tooltips(graph: bpmn.ProcessGraph) -> None:
    svg = bpmn.to_svg(graph, heat={"register": 60_000, "ship": 3 * 86_400_000})
    assert svg is not None
    assert "Prepare shipment · median 3.0 d" in svg
    assert "Register request · median 1 min" in svg
    assert 'fill="#e34a33"' in svg  # the slowest task gets the darkest color


def test_svg_escapes_hostile_names(xml: bytes) -> None:
    hostile = xml.replace(
        b'name="Register request"',
        b'name="&lt;script&gt;alert(1)&lt;/script&gt;&quot; onload=&quot;x"',
    ).replace(b'name="Front office"', b'name="&lt;a href=&quot;http://x&quot;&gt;"')
    svg = bpmn.to_svg(bpmn.parse_bpmn(hostile))
    assert svg is not None
    assert "<script" not in svg
    assert "<a " not in svg
    assert "&lt;script&gt;" in svg
    bpmn.check_svg(svg)


@pytest.mark.parametrize(
    "svg",
    [
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="x"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:x="http://www.w3.org/1999/xlink">'
        '<rect x:href="http://x"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(http://x/a.svg#p)"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>',
    ],
)
def test_check_svg_refuses_active_content(svg: str) -> None:
    with pytest.raises(bpmn.BpmnError):
        bpmn.check_svg(svg)


def test_no_layout_means_no_svg(xml: bytes) -> None:
    graph = bpmn.parse_bpmn(_no_layout(xml))
    assert graph.node("register") is not None
    assert bpmn.to_svg(graph) is None


def test_svg_over_the_size_bound_is_dropped(
    graph: bpmn.ProcessGraph, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(bpmn, "MAX_SVG_BYTES", 1000)
    assert bpmn.to_svg(graph) is None


def test_entities_and_dtds_are_refused() -> None:
    xxe = (
        b'<?xml version="1.0"?><!DOCTYPE d [<!ENTITY x SYSTEM "file:///etc/passwd">]>'
        b'<definitions><process id="p"><startEvent id="s" name="&x;"/></process></definitions>'
    )
    with pytest.raises(bpmn.BpmnError):
        bpmn.parse_bpmn(xxe)


def test_document_without_a_process_is_refused() -> None:
    with pytest.raises(bpmn.BpmnError, match="no <process>"):
        bpmn.parse_bpmn(b"<definitions/>")


def test_nested_subprocess_nodes_are_included() -> None:
    xml = (
        b'<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">'
        b'<process id="p"><startEvent id="s"/><subProcess id="sp" name="Inner">'
        b'<userTask id="t" name="Inner task"/></subProcess>'
        b'<sequenceFlow id="f" sourceRef="s" targetRef="sp"/></process></definitions>'
    )
    graph = bpmn.parse_bpmn(xml)
    assert [n.id for n in graph.nodes] == ["s", "sp", "t"]


def test_format_duration() -> None:
    assert bpmn.format_duration(30_000) == "30 s"
    assert bpmn.format_duration(45 * 60_000) == "45 min"
    assert bpmn.format_duration(5 * 3_600_000) == "5.0 h"
    assert bpmn.format_duration(3 * 86_400_000) == "3.0 d"


def test_a_missing_process_key_is_refused(xml: bytes) -> None:
    with pytest.raises(bpmn.BpmnError, match="no process with id 'other'"):
        bpmn.parse_bpmn(xml, "other")
