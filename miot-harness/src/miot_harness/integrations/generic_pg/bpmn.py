"""BPMN 2.0 process XML → graph, Mermaid flowchart and SVG.

Engine-agnostic (Activiti, Flowable, Camunda): elements are matched by local
name, so vendor namespaces do not matter. The SVG is drawn from the diagram
interchange (BPMNShape bounds, BPMNEdge waypoints) the modeler saved with the
process; a process without it gets Mermaid only.
"""

from __future__ import annotations

import math
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any
from xml.etree.ElementTree import Element
from xml.sax.saxutils import escape

import defusedxml.ElementTree as SafeET

MAX_XML_BYTES = 5_000_000
MAX_NODES = 600
MAX_SVG_BYTES = 400_000

_FLOW_NODES = frozenset(
    {
        "startEvent",
        "endEvent",
        "intermediateCatchEvent",
        "intermediateThrowEvent",
        "boundaryEvent",
        "task",
        "userTask",
        "serviceTask",
        "scriptTask",
        "manualTask",
        "receiveTask",
        "sendTask",
        "businessRuleTask",
        "callActivity",
        "subProcess",
        "transaction",
        "adHocSubProcess",
        "exclusiveGateway",
        "parallelGateway",
        "inclusiveGateway",
        "eventBasedGateway",
        "complexGateway",
    }
)
_CONTAINERS = frozenset({"subProcess", "transaction", "adHocSubProcess"})
_GATEWAY_SYMBOL = {
    "exclusiveGateway": "X",
    "parallelGateway": "+",
    "inclusiveGateway": "O",
    "eventBasedGateway": "E",
    "complexGateway": "*",
}
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class BpmnError(ValueError):
    pass


Bounds = tuple[float, float, float, float]
Point = tuple[float, float]


@dataclass(frozen=True)
class Node:
    id: str
    type: str
    name: str
    form_key: str | None = None
    lane: str | None = None
    bounds: Bounds | None = None
    label_at: Point | None = None


@dataclass(frozen=True)
class Edge:
    id: str
    source: str
    target: str
    name: str = ""
    condition: str = ""
    default: bool = False
    back: bool = False
    waypoints: tuple[Point, ...] = ()
    label_at: Point | None = None


@dataclass(frozen=True)
class Lane:
    id: str
    name: str
    bounds: Bounds | None = None


@dataclass(frozen=True)
class ProcessGraph:
    process_id: str
    name: str
    nodes: tuple[Node, ...]
    edges: tuple[Edge, ...]
    lanes: tuple[Lane, ...] = field(default_factory=tuple)

    def node(self, node_id: str) -> Node | None:
        return next((n for n in self.nodes if n.id == node_id), None)

    def to_json(self) -> dict[str, Any]:
        nodes = [
            {
                k: v
                for k, v in {
                    "id": n.id,
                    "type": n.type,
                    "name": n.name or None,
                    "formKey": n.form_key,
                    "lane": n.lane,
                }.items()
                if v
            }
            for n in self.nodes
        ]
        edges = [
            {
                k: v
                for k, v in {
                    "from": e.source,
                    "to": e.target,
                    "condition": e.condition or None,
                    "name": e.name or None,
                    "default": e.default,
                    "back": e.back,
                }.items()
                if v
            }
            for e in self.edges
        ]
        return {"nodes": nodes, "edges": edges}


def _local(tag: object) -> str:
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def _attr(el: Element, local_name: str) -> str | None:
    for key, value in el.attrib.items():
        if _local(key) == local_name:
            return value
    return None


def _clean(text: str | None) -> str:
    return " ".join(_CONTROL_CHARS.sub("", text or "").split())


def _floats(el: Element, *names: str) -> tuple[float, ...] | None:
    try:
        values = tuple(float(el.attrib[n]) for n in names)
    except (KeyError, ValueError):
        return None
    if any(not math.isfinite(v) or abs(v) > 1e6 for v in values):
        return None
    return values


def _pick_process(root: Element, process_key: str | None) -> Element:
    processes = [el for el in root.iter() if _local(el.tag) == "process"]
    if not processes:
        raise BpmnError("no <process> element in the definition")
    if process_key:
        for el in processes:
            if el.get("id") == process_key:
                return el
        raise BpmnError(f"no process with id {process_key!r} in the definition")
    executable = [p for p in processes if (p.get("isExecutable") or "true").lower() == "true"]
    return (executable or processes)[0]


def _collect(container: Element, nodes: list[Element], flows: list[Element]) -> None:
    for child in container:
        name = _local(child.tag)
        if name in _FLOW_NODES:
            nodes.append(child)
            if name in _CONTAINERS:
                _collect(child, nodes, flows)
        elif name == "sequenceFlow":
            flows.append(child)


def _lanes(process: Element) -> tuple[dict[str, str], list[tuple[str, str]]]:
    lane_of: dict[str, str] = {}
    lanes: list[tuple[str, str]] = []
    for lane in process.iter():
        if _local(lane.tag) != "lane":
            continue
        lane_id = lane.get("id") or ""
        lane_name = _clean(lane.get("name")) or lane_id
        lanes.append((lane_id, lane_name))
        for ref in lane:
            if _local(ref.tag) == "flowNodeRef" and ref.text:
                lane_of[ref.text.strip()] = lane_name
    return lane_of, lanes


def _bounds(el: Element) -> Bounds | None:
    """The first `Bounds` child with a positive size."""
    for child in el:
        if _local(child.tag) == "Bounds":
            b = _floats(child, "x", "y", "width", "height")
            if b is not None and b[2] > 0 and b[3] > 0:
                return (b[0], b[1], b[2], b[3])
    return None


def _label_center(el: Element) -> Point | None:
    for label in el:
        if _local(label.tag) == "BPMNLabel":
            b = _bounds(label)
            if b is not None:
                return (b[0] + b[2] / 2, b[1] + b[3] / 2)
    return None


def _waypoints(el: Element) -> tuple[Point, ...]:
    points = (_floats(c, "x", "y") for c in el if _local(c.tag) == "waypoint")
    return tuple((p[0], p[1]) for p in points if p is not None)


@dataclass
class _Diagram:
    shapes: dict[str, Bounds] = field(default_factory=dict)
    waypoints: dict[str, tuple[Point, ...]] = field(default_factory=dict)
    labels: dict[str, Point] = field(default_factory=dict)


def _diagram(root: Element) -> _Diagram:
    d = _Diagram()
    for el in root.iter():
        kind = _local(el.tag)
        ref = el.get("bpmnElement")
        if not ref or kind not in ("BPMNShape", "BPMNEdge"):
            continue
        label = _label_center(el)
        if label is not None:
            d.labels[ref] = label
        if kind == "BPMNShape":
            bounds = _bounds(el)
            if bounds is not None:
                d.shapes[ref] = bounds
        else:
            points = _waypoints(el)
            if len(points) >= 2:
                d.waypoints[ref] = points
    return d


def _walk(
    root: str, out: dict[str, list[tuple[str, str]]], state: dict[str, int], back: set[str]
) -> None:
    """Iterative DFS from `root`; state 1 = on the stack, 2 = done."""
    state[root] = 1
    stack: list[tuple[str, int]] = [(root, 0)]
    while stack:
        node, i = stack[-1]
        if i >= len(out[node]):
            state[node] = 2
            stack.pop()
            continue
        stack[-1] = (node, i + 1)
        edge_id, nxt = out[node][i]
        seen = state.get(nxt)
        if seen == 1:
            back.add(edge_id)
        elif seen is None:
            state[nxt] = 1
            stack.append((nxt, 0))


def _back_edges(node_ids: list[str], edges: list[tuple[str, str, str]]) -> set[str]:
    """Edge ids that close a cycle, found by a DFS from the entry nodes."""
    out: dict[str, list[tuple[str, str]]] = {n: [] for n in node_ids}
    has_incoming: set[str] = set()
    for edge_id, src, dst in edges:
        if src in out and dst in out:
            out[src].append((edge_id, dst))
            has_incoming.add(dst)
    state: dict[str, int] = {}
    back: set[str] = set()
    for root in [n for n in node_ids if n not in has_incoming] + node_ids:
        if root not in state:
            _walk(root, out, state, back)
    return back


def _read_root(xml: bytes | str) -> Element:
    raw = xml.encode() if isinstance(xml, str) else xml
    if len(raw) > MAX_XML_BYTES:
        raise BpmnError(f"definition is larger than {MAX_XML_BYTES} bytes")
    try:
        root: Element = SafeET.fromstring(raw, forbid_dtd=True)
    except Exception as exc:  # noqa: BLE001 — ParseError and defusedxml refusals alike
        raise BpmnError(f"not a readable BPMN document: {exc}") from exc
    return root


def _condition(flow: Element) -> str:
    for child in flow:
        if _local(child.tag) == "conditionExpression":
            return _clean("".join(child.itertext()))
    return ""


def _node(el: Element, lane_of: dict[str, str], diagram: _Diagram) -> Node:
    node_id = el.get("id") or ""
    return Node(
        id=node_id,
        type=_local(el.tag),
        name=_clean(el.get("name")),
        form_key=_attr(el, "formKey"),
        lane=lane_of.get(node_id),
        bounds=diagram.shapes.get(node_id),
        label_at=diagram.labels.get(node_id),
    )


def _edges(
    flow_els: list[Element], node_ids: list[str], defaults: set[str], diagram: _Diagram
) -> tuple[Edge, ...]:
    ends = [(el.get("id") or "", el.get("sourceRef") or "", el.get("targetRef") or "")
            for el in flow_els]  # fmt: skip
    back = _back_edges(node_ids, ends)
    return tuple(
        Edge(
            id=eid,
            source=src,
            target=dst,
            name=_clean(el.get("name")),
            condition=_condition(el),
            default=eid in defaults,
            back=eid in back,
            waypoints=diagram.waypoints.get(eid, ()),
            label_at=diagram.labels.get(eid),
        )
        for el, (eid, src, dst) in zip(flow_els, ends, strict=True)
    )


def parse_bpmn(xml: bytes | str, process_key: str | None = None) -> ProcessGraph:
    """Parse one process of a BPMN definition. DTDs and entities are refused."""
    root = _read_root(xml)
    process = _pick_process(root, process_key)
    node_els: list[Element] = []
    flow_els: list[Element] = []
    _collect(process, node_els, flow_els)
    if len(node_els) > MAX_NODES:
        raise BpmnError(f"process has {len(node_els)} nodes; the limit is {MAX_NODES}")
    lane_of, lane_list = _lanes(process)
    diagram = _diagram(root)
    nodes = tuple(_node(el, lane_of, diagram) for el in node_els if el.get("id"))
    defaults = {d for el in node_els if (d := el.get("default"))}
    return ProcessGraph(
        process_id=process.get("id") or "",
        name=_clean(process.get("name")) or process.get("id") or "",
        nodes=nodes,
        edges=_edges(flow_els, [n.id for n in nodes], defaults, diagram),
        lanes=tuple(Lane(id=i, name=n, bounds=diagram.shapes.get(i)) for i, n in lane_list),
    )


_EQUALS_LITERAL = re.compile(r"""^[\w.]+\s*==\s*(?:'([^']*)'|"([^"]*)")$""")


def short_condition(condition: str, limit: int = 40) -> str:
    """`${outcome=='Approve'}` → `Approve`; other expressions lose the `${}`
    and are cut to `limit` chars."""
    text = condition.strip()
    if text.startswith(("${", "#{")) and text.endswith("}"):
        text = text[2:-1].strip()
    match = _EQUALS_LITERAL.match(text)
    if match:
        text = match.group(1) if match.group(1) is not None else match.group(2)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def edge_label(edge: Edge) -> str:
    if edge.name:
        return edge.name
    if edge.condition:
        return short_condition(edge.condition)
    return "default" if edge.default else ""


# --- Mermaid ---------------------------------------------------------------


def _mermaid_text(text: str) -> str:
    return (
        text.replace("&", "#amp;")
        .replace('"', "#quot;")
        .replace("<", "#lt;")
        .replace(">", "#gt;")
        .replace("|", "#124;")
    )


def to_mermaid(graph: ProcessGraph) -> str:
    alias = {n.id: f"n{i}" for i, n in enumerate(graph.nodes)}
    lines = ["flowchart LR"]
    for n in graph.nodes:
        label = _mermaid_text(n.name or _GATEWAY_SYMBOL.get(n.type, n.type))
        a = alias[n.id]
        if n.type.endswith("Gateway"):
            lines.append(f'  {a}{{"{label}"}}')
        elif n.type.endswith("Event"):
            lines.append(f'  {a}(("{label}"))')
        else:
            lines.append(f'  {a}["{label}"]')
    for e in graph.edges:
        if e.source not in alias or e.target not in alias:
            continue
        arrow = "-.->" if e.back else "-->"
        label = edge_label(e)
        text = f'|"{_mermaid_text(label)}"|' if label else ""
        lines.append(f"  {alias[e.source]} {arrow}{text} {alias[e.target]}")
    return "\n".join(lines)


# --- SVG -------------------------------------------------------------------

_HEAT = ("#fff7ec", "#fee8c8", "#fdd49e", "#fdbb84", "#fc8d59", "#e34a33")
_SVG_TAGS = frozenset(
    {"svg", "defs", "marker", "path", "rect", "circle", "polygon", "polyline", "text",
     "tspan", "g", "title", "line"}
)  # fmt: skip


def _n(value: float) -> str:
    return f"{value:.1f}".rstrip("0").rstrip(".")


def _wrap(text: str, width_px: float, max_lines: int = 4) -> list[str]:
    per_line = max(6, int(width_px / 6.2))
    words, lines, current = text.split(), [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) <= per_line or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = lines[-1][: per_line - 1] + "…"
    return [line if len(line) <= per_line else line[: per_line - 1] + "…" for line in lines]


def _text(at: Point, lines: list[str], size: int = 11, anchor: str = "middle") -> str:
    if not lines:
        return ""
    x, y = at
    top = y - (len(lines) - 1) * (size + 2) / 2
    spans = "".join(
        f'<tspan x="{_n(x)}" y="{_n(top + i * (size + 2))}">{escape(line)}</tspan>'
        for i, line in enumerate(lines)
    )
    return (
        f'<text font-size="{size}" text-anchor="{anchor}" dominant-baseline="middle" '
        f'fill="#1f2937">{spans}</text>'
    )


def format_duration(ms: float) -> str:
    minutes = ms / 60000
    if minutes < 1:
        return f"{ms / 1000:.0f} s"
    if minutes < 120:
        return f"{minutes:.0f} min"
    hours = minutes / 60
    if hours < 48:
        return f"{hours:.1f} h"
    return f"{hours / 24:.1f} d"


def _heat_colors(heat: Mapping[str, float]) -> dict[str, str]:
    values = sorted(v for v in heat.values() if v is not None)
    if not values:
        return {}
    top = len(values) - 1 or 1
    out = {}
    for node_id, value in heat.items():
        rank = values.index(value) / top
        out[node_id] = _HEAT[min(len(_HEAT) - 1, int(rank * (len(_HEAT) - 1) + 0.5))]
    return out


def _extent(graph: ProcessGraph) -> tuple[float, float, float, float] | None:
    xs: list[float] = []
    ys: list[float] = []
    for b in [n.bounds for n in graph.nodes] + [lane.bounds for lane in graph.lanes]:
        if b:
            xs += [b[0], b[0] + b[2]]
            ys += [b[1], b[1] + b[3] + 28]
    for e in graph.edges:
        for x, y in e.waypoints:
            xs.append(x)
            ys.append(y)
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def _name_at(n: Node, *, above: bool) -> Point:
    if n.label_at is not None:
        return n.label_at
    assert n.bounds is not None
    x, y, w, h = n.bounds
    return (x + w / 2, y - 10) if above else (x + w / 2, y + h + 12)


def _svg_node(n: Node, fill: str, tooltip: str) -> str:
    assert n.bounds is not None
    x, y, w, h = n.bounds
    cx, cy = x + w / 2, y + h / 2
    title = f"<title>{escape(tooltip)}</title>"
    if n.type.endswith("Gateway"):
        pts = f"{_n(cx)},{_n(y)} {_n(x + w)},{_n(cy)} {_n(cx)},{_n(y + h)} {_n(x)},{_n(cy)}"
        symbol = _GATEWAY_SYMBOL.get(n.type, "")
        return (
            f'<g>{title}<polygon points="{pts}" fill="#fef9c3" stroke="#475569" '
            f'stroke-width="1.5"/>{_text((cx, cy), [symbol], 14)}'
            f"{_text(_name_at(n, above=True), _wrap(n.name, max(w, 120), 2), 10)}</g>"
        )
    if n.type.endswith("Event"):
        r = min(w, h) / 2
        stroke = "3" if n.type == "endEvent" else "1.5"
        color = "#b91c1c" if n.type == "endEvent" else "#15803d"
        if n.type not in ("startEvent", "endEvent"):
            color = "#475569"
        return (
            f'<g>{title}<circle cx="{_n(cx)}" cy="{_n(cy)}" r="{_n(r)}" fill="#ffffff" '
            f'stroke="{color}" stroke-width="{stroke}"/>'
            f"{_text(_name_at(n, above=False), _wrap(n.name, max(w, 120), 2), 10)}</g>"
        )
    return (
        f'<g>{title}<rect x="{_n(x)}" y="{_n(y)}" width="{_n(w)}" height="{_n(h)}" rx="10" '
        f'fill="{fill}" stroke="#475569" stroke-width="1.5"/>'
        f"{_text((cx, cy), _wrap(n.name or n.type, w - 8), 11)}</g>"
    )


def _svg_edge(e: Edge) -> str:
    pts = " ".join(f"{_n(x)},{_n(y)}" for x, y in e.waypoints)
    dash = ' stroke-dasharray="5 4"' if e.back else ""
    color = "#b45309" if e.back else "#64748b"
    out = (
        f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="1.3"{dash} '
        f'marker-end="url(#arrow)"/>'
    )
    label = short_condition(edge_label(e), 32)
    if label:
        if e.label_at is not None:
            out += _text(e.label_at, [label], 9)
        else:
            x, y = e.waypoints[1]
            out += _text((x + 4, y - 7), [label], 9, anchor="start")
    return out


def to_svg(
    graph: ProcessGraph,
    *,
    heat: Mapping[str, float] | None = None,
    title: str | None = None,
) -> str | None:
    """Draw the process from its saved layout; None when it has no layout.

    `heat` maps node id → a duration in ms; those nodes are filled on a light to
    dark scale by rank and the duration goes in their tooltip.
    """
    placed = [n for n in graph.nodes if n.bounds]
    if not placed or len(placed) < len(graph.nodes) / 2:
        return None
    extent = _extent(graph)
    if extent is None:
        return None
    pad, head = 20.0, 28.0 if title else 0.0
    min_x, min_y, max_x, max_y = extent
    width, height = max_x - min_x + 2 * pad, max_y - min_y + 2 * pad + head
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {_n(width)} {_n(height)}" '
        f'width="{_n(width)}" height="{_n(height)}" font-family="sans-serif">',
        '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" '
        'markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" '
        'fill="#64748b"/></marker></defs>',
        f'<rect x="0" y="0" width="{_n(width)}" height="{_n(height)}" fill="#ffffff"/>',
        _text((pad, pad + 4), [title[:120]], 14, anchor="start") if title else "",
        f'<g transform="translate({_n(pad - min_x)},{_n(pad - min_y + head)})">',
        *(_svg_lane(lane) for lane in graph.lanes if lane.bounds),
        *(_svg_edge(e) for e in graph.edges if len(e.waypoints) >= 2),
        *_svg_nodes(placed, heat or {}),
        "</g></svg>",
    ]
    svg = "".join(parts)
    if len(svg.encode()) > MAX_SVG_BYTES:
        return None
    check_svg(svg)
    return svg


def _svg_lane(lane: Lane) -> str:
    assert lane.bounds is not None
    x, y, w, h = lane.bounds
    return (
        f'<rect x="{_n(x)}" y="{_n(y)}" width="{_n(w)}" height="{_n(h)}" '
        f'fill="#f8fafc" stroke="#cbd5e1"/>'
        + _text((x + 6, y + 12), [lane.name[:60]], 10, anchor="start")
    )


def _svg_nodes(placed: list[Node], heat: Mapping[str, float]) -> list[str]:
    colors = _heat_colors(heat)
    out = []
    for n in placed:
        value = heat.get(n.id)
        tooltip = n.name or n.type
        if value is not None:
            tooltip += f" · median {format_duration(value)}"
        out.append(_svg_node(n, colors.get(n.id, "#ffffff"), tooltip))
    return out


def check_svg(svg: str) -> None:
    """Refuse anything but the plain shapes this module draws: no scripts,
    event handlers, foreign content or links."""
    root = SafeET.fromstring(svg, forbid_dtd=True)
    for el in root.iter():
        if _local(el.tag) not in _SVG_TAGS:
            raise BpmnError(f"unexpected SVG element {_local(el.tag)!r}")
        for key, value in el.attrib.items():
            name = _local(key).lower()
            if name.startswith("on") or "href" in name:
                raise BpmnError(f"unexpected SVG attribute {name!r}")
            if "url(" in value and value != "url(#arrow)":
                raise BpmnError("SVG references outside the document")
