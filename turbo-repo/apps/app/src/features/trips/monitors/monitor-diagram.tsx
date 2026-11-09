"use client";

import { useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  HiBell,
  HiCheckCircle,
  HiClock,
  HiCog,
  HiFlag,
  HiLocationMarker,
  HiPlay,
  HiTerminal,
  HiXCircle,
} from "react-icons/hi";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import { buildGraph, type GraphEdge, type GraphNode } from "./monitor-graph";
import type { MonitorBody, Trigger } from "./monitors-api";

type Data = { node: GraphNode; label: string; sub?: string; selected: boolean };

const handles = (
  <>
    <Handle type="target" position={Position.Left} id="l" className="!opacity-0" />
    <Handle type="source" position={Position.Right} id="r" className="!opacity-0" />
    <Handle type="target" position={Position.Top} id="t" className="!opacity-0" />
    <Handle type="source" position={Position.Bottom} id="b" className="!opacity-0" />
    <Handle type="source" position={Position.Top} id="ts" className="!opacity-0" />
    <Handle type="target" position={Position.Bottom} id="bt" className="!opacity-0" />
  </>
);

function StageNode({ data }: NodeProps<Node<Data>>) {
  return (
    <div
      className={`min-w-44 rounded-lg border-2 bg-white px-4 py-3 text-center shadow-sm dark:bg-gray-800 ${
        data.selected
          ? "border-primary-600 ring-4 ring-primary-200 dark:ring-primary-900"
          : "border-primary-500 dark:border-primary-400"
      }`}
    >
      {handles}
      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {data.sub}
      </div>
      <div className="text-sm font-semibold text-gray-900 dark:text-white">{data.label}</div>
    </div>
  );
}

function MilestoneNode({ data }: NodeProps<Node<Data>>) {
  return (
    <div className="relative flex h-24 w-40 items-center justify-center">
      {handles}
      <div
        className={`absolute h-20 w-20 rotate-45 rounded-md border-2 bg-amber-50 dark:bg-amber-950 ${
          data.selected ? "border-amber-600 ring-4 ring-amber-200" : "border-amber-500"
        }`}
      />
      <div className="relative text-center">
        <div className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
          {data.sub}
        </div>
        <div className="text-xs font-semibold text-gray-900 dark:text-white">{data.label}</div>
      </div>
    </div>
  );
}

function AlertNode({ data }: NodeProps<Node<Data>>) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border bg-red-50 px-3 py-1 text-xs text-red-800 dark:bg-red-950 dark:text-red-200 ${
        data.selected ? "border-red-600 ring-4 ring-red-200" : "border-red-300 dark:border-red-700"
      }`}
    >
      {handles}
      {data.node.kind === "alert" && data.sub === "invoke" ? (
        <HiCog className="h-3.5 w-3.5" />
      ) : (
        <HiBell className="h-3.5 w-3.5" />
      )}
      <span className="font-mono">{data.label}</span>
    </div>
  );
}

function TerminalNode({ data }: NodeProps<Node<Data>>) {
  const icon =
    data.node.kind === "start" ? (
      <HiPlay className="h-5 w-5" />
    ) : data.node.kind === "end" ? (
      <HiCheckCircle className="h-5 w-5" />
    ) : data.node.kind === "cancelled" ? (
      <HiXCircle className="h-5 w-5" />
    ) : (
      <HiLocationMarker className="h-5 w-5" />
    );
  const tone =
    data.node.kind === "end"
      ? "border-green-500 text-green-700 dark:text-green-300"
      : data.node.kind === "cancelled"
        ? "border-red-500 text-red-700 dark:text-red-300"
        : data.node.kind === "any"
          ? "border-dashed border-gray-400 text-gray-600 dark:text-gray-300"
          : "border-gray-500 text-gray-700 dark:text-gray-200";
  return (
    <div
      className={`flex items-center gap-2 rounded-full border-2 bg-white px-4 py-2 text-sm font-medium dark:bg-gray-800 ${tone}`}
    >
      {handles}
      {icon}
      {data.label}
    </div>
  );
}

const nodeTypes = {
  stage: StageNode,
  milestone: MilestoneNode,
  alert: AlertNode,
  terminal: TerminalNode,
};

const TRIGGER_ICON: Record<Trigger, string> = {
  plan: "▶",
  signal: "📍",
  timer: "⏱",
  stage: "↻",
  command: "✋",
};

/** A translation, or the fallback when the key is missing. */
function trOr(key: string, d: I18nRecord, fallback: string): string {
  const t = trDynamic(key, d);
  return t === key ? fallback : t;
}

/**
 * Reads the common shapes of an expression in plain words: trip times,
 * `minutes(params.x)` with the parameter's value, and milestone status tests.
 * Anything else is left as written.
 */
export function humanize(
  expr: string,
  params: Record<string, unknown>,
  d: I18nRecord
): string {
  return expr
    .replace(/trip\.plannedEnd/g, trOr("diagram.plannedEnd", d, "plannedEnd"))
    .replace(/trip\.plannedStart/g, trOr("diagram.plannedStart", d, "plannedStart"))
    .replace(/(minutes|hours)\(params\.(\w+)\)/g, (_, unit: string, p: string) => {
      const v = params[p];
      const u = unit === "minutes" ? "min" : "h";
      return v === undefined ? `${p} ${u}` : `${v} ${u}`;
    })
    .replace(/(minutes|hours)\((\d+)\)/g, (_, unit: string, n: string) => `${n} ${unit === "minutes" ? "min" : "h"}`)
    .replace(
      /milestones\.(\w+)\.status\s*(==|!=)\s*["'](\w+)["']/g,
      (_, m: string, op: string, s: string) => {
        const name = trOr(`milestones.${m}`, d, m);
        const status = trOr(`milestoneStatus.${s}`, d, s).toLowerCase();
        return op === "==" ? `${name} ${status}` : `${name} ${trOr("diagram.not", d, "no")} ${status}`;
      }
    )
    .replace(/\s*&&\s*/g, ` ${trOr("diagram.and", d, "y")} `)
    .replace(/\s*\|\|\s*/g, ` ${trOr("diagram.or", d, "o")} `);
}

function eventLabel(e: GraphEdge, d: I18nRecord, params: Record<string, unknown>): string {
  if (!e.event) return tr(`triggers.${e.on}`, d);
  if (e.on === "signal") return trOr(`signalKinds.${e.event}`, d, e.event);
  if (e.on === "timer") return humanize(e.event, params, d);
  const m = e.event.match(/^(\w+)_(confirmed|rejected)$/);
  if (m) {
    return `${tr(`milestones.${m[1]}`, d)} ${tr(`diagram.${m[2]}`, d)}`;
  }
  if (e.event === "created") return tr("diagram.planCreated", d);
  return e.event;
}

/**
 * The monitor as a state diagram, drawn from the same plan and rules the cards
 * below edit. Clicking a stage, milestone or arrow selects its rule.
 */
export default function MonitorDiagram({
  body,
  d,
  selectedRule,
  onSelectRule,
}: Readonly<{
  body: MonitorBody;
  d: I18nRecord;
  selectedRule: string | null;
  onSelectRule: (key: string | null) => void;
}>) {
  const graph = useMemo(() => buildGraph(body), [body]);

  const nodes: Node<Data>[] = useMemo(
    () =>
      graph.nodes.map((n) => {
        const selected = !!selectedRule && n.ruleKeys.includes(selectedRule);
        let label: string;
        let sub: string | undefined;
        let type: keyof typeof nodeTypes = "terminal";
        switch (n.kind) {
          case "stage":
            type = "stage";
            label = tr(`stages.${n.value}`, d);
            if (label === `stages.${n.value}`) label = n.value ?? "";
            sub = tr("diagram.stage", d);
            break;
          case "milestone":
            type = "milestone";
            label = tr(`milestones.${n.value}`, d);
            sub = tr("milestone", d);
            break;
          case "alert":
            type = "alert";
            label = n.value ?? "";
            sub = n.id.split(":")[0];
            break;
          default:
            label = tr(`diagram.${n.kind}`, d);
        }
        return {
          id: n.id,
          type,
          position: { x: n.x, y: n.y },
          data: { node: n, label, sub, selected },
          draggable: true,
        };
      }),
    [graph, d, selectedRule]
  );

  const edges: Edge[] = useMemo(() => {
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    return graph.edges.map((e) => {
      const s = byId.get(e.source)!;
      const t = byId.get(e.target)!;
      const selected = e.ruleKey === selectedRule;
      const toAlert = t.kind === "alert";
      const down = t.y > s.y + 40;
      const up = t.y < s.y - 40;
      const self = e.source === e.target;
      const params = body.params as Record<string, unknown>;
      const label = `${TRIGGER_ICON[e.on]} ${eventLabel(e, d, params)}${
        e.guard ? `  ·  ${humanize(e.guard, params, d)}` : ""
      }${
        e.action === "close" ? `  ·  ${tr("actions.close", d)}` : ""
      }`;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: self ? "ts" : up ? "ts" : down ? "b" : "r",
        targetHandle: self ? "t" : up ? "bt" : down ? "t" : "l",
        type: "smoothstep",
        label: toAlert ? undefined : label,
        data: { ruleKey: e.ruleKey },
        animated: selected,
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
        style: {
          strokeWidth: selected ? 3 : 1.6,
          strokeDasharray: e.active ? undefined : "6 4",
          opacity: e.active ? 1 : 0.45,
          stroke: selected ? "var(--color-primary-600, #1c64f2)" : toAlert ? "#f05252" : undefined,
        },
        labelStyle: { fontSize: 11 },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
      } satisfies Edge;
    });
  }, [graph, d, selectedRule, body.params]);

  const legend = [
    { icon: <HiPlay />, text: tr("diagram.legendStage", d) },
    { icon: <HiFlag />, text: tr("diagram.legendMilestone", d) },
    { icon: <HiBell />, text: tr("diagram.legendAlert", d) },
    { icon: <HiLocationMarker />, text: `📍 ${tr("triggers.signal", d)}` },
    { icon: <HiClock />, text: `⏱ ${tr("triggers.timer", d)}` },
    { icon: <HiTerminal />, text: `✋ ${tr("triggers.command", d)}` },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="h-[520px] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.3}
          // The wheel scrolls the page; Ctrl/⌘ + wheel and the buttons zoom.
          zoomOnScroll={false}
          panOnScroll={false}
          preventScrolling={false}
          zoomActivationKeyCode={["Meta", "Control"]}
          proOptions={{ hideAttribution: true }}
          onEdgeClick={(_, edge) => onSelectRule((edge.data as { ruleKey: string }).ruleKey)}
          onNodeClick={(_, node) => {
            const keys = (node.data as Data).node.ruleKeys;
            if (keys.length > 0) onSelectRule(keys[0]);
          }}
          onPaneClick={() => onSelectRule(null)}
          nodesConnectable={false}
        >
          <Background gap={20} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        {legend.map((l) => (
          <span key={l.text} className="flex items-center gap-1">
            {l.text}
          </span>
        ))}
        <span>— — {tr("diagram.legendInactive", d)}</span>
      </div>
    </div>
  );
}
