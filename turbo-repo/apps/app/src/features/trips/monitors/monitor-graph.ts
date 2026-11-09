/**
 * Turns a monitor's plan and rules into a state diagram: stages and milestones
 * are nodes, each rule action is an edge from where the rule applies to what it
 * does. Pure: the diagram component only lays it out.
 */

import { MILESTONES, type MonitorBody, type Rule } from "./monitors-api";

export type NodeKind =
  | "start"
  | "stage"
  | "milestone"
  | "alert"
  | "end"
  | "cancelled"
  | "any";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  /** Stage type, milestone, alert key or process name. */
  value: string | null;
  x: number;
  y: number;
  /** Rules that produce this node (alerts, milestones). */
  ruleKeys: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  ruleKey: string;
  ruleName: string | null;
  on: Rule["on"];
  /** The event the rule waits for: a signal kind, a command kind or a timer expression. */
  event: string | null;
  /** What is left of `when` once the event and the stage are read out of it. */
  guard: string | null;
  action: Rule["then"][number]["type"];
  active: boolean;
  /** Extra effects of the same rule shown as a note (e.g. closeMandates). */
  notes: string[];
}

export interface MonitorGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const COL = 340;
const ROW_MAIN = 220;
const ROW_ALERTS = 40;
const ROW_MILESTONES = 430;

const STAGE_RE = /stage\.type\s*==\s*["']([\w-]+)["']/g;
const SIGNAL_RE = /signal\.kind\s*==\s*["']([\w-]+)["']/;
const EVENT_RE = /event\.kind\s*==\s*["']([\w-]+)["']/;
const MILESTONE_EVENT_RE = /^(\w+)_(confirmed|rejected)$/;

/** Stage types the condition names (`stage.type == "x"`), in order. */
export function guardStages(when: string | null): string[] {
  if (!when) return [];
  return [...when.matchAll(STAGE_RE)].map((m) => m[1]);
}

/** The event kind a rule waits for, read from its condition. */
export function eventOf(rule: Rule): string | null {
  if (rule.on === "timer") return rule.at;
  const re = rule.on === "signal" ? SIGNAL_RE : EVENT_RE;
  return rule.when?.match(re)?.[1] ?? null;
}

/** The condition without the event and stage tests, or null when nothing else is left. */
export function guardOf(rule: Rule): string | null {
  if (!rule.when) return null;
  const rest = rule.when
    .replace(SIGNAL_RE, "")
    .replace(EVENT_RE, "")
    .replace(/\(?\s*stage\.type\s*==\s*["'][\w-]+["']\s*(\|\|\s*stage\.type\s*==\s*["'][\w-]+["']\s*)*\)?/g, "")
    .replace(/^\s*(&&|\|\|)\s*/, "")
    .replace(/\s*(&&|\|\|)\s*$/, "")
    .replace(/\s*&&\s*&&\s*/g, " && ")
    .trim();
  return rest.length > 0 && rest !== "true" ? rest : null;
}

/** The milestone a command reacts to (`arrival_confirmed` → arrival). */
function milestoneEvent(rule: Rule): { milestone: string; outcome: string } | null {
  if (rule.on !== "command") return null;
  const m = eventOf(rule)?.match(MILESTONE_EVENT_RE);
  return m ? { milestone: m[1], outcome: m[2] } : null;
}

export function buildGraph(body: MonitorBody): MonitorGraph {
  const stages = body.plan.map((s) => s.stageType);
  const stageX = new Map(stages.map((s, i) => [s, (i + 1) * COL]));
  const endX = (stages.length + 1) * COL;

  const nodes = new Map<string, GraphNode>();
  const add = (n: Omit<GraphNode, "ruleKeys">) => {
    if (!nodes.has(n.id)) nodes.set(n.id, { ...n, ruleKeys: [] });
    return nodes.get(n.id)!;
  };
  add({ id: "start", kind: "start", value: null, x: 0, y: ROW_MAIN });
  stages.forEach((s) =>
    add({ id: `stage:${s}`, kind: "stage", value: s, x: stageX.get(s)!, y: ROW_MAIN })
  );

  const stageNode = (s: string) => {
    if (!stageX.has(s)) {
      // A rule names a stage the plan does not have: show it after the plan.
      stageX.set(s, endX + COL * (stageX.size - stages.length + 1));
      add({ id: `stage:${s}`, kind: "stage", value: s, x: stageX.get(s)!, y: ROW_MAIN });
    }
    return `stage:${s}`;
  };
  const milestoneNode = (m: string) => add({ id: `milestone:${m}`, kind: "milestone", value: m, x: 0, y: ROW_MILESTONES });

  const edges: GraphEdge[] = [];
  const alertsPerSource = new Map<string, number>();

  for (const rule of body.rules) {
    const me = milestoneEvent(rule);
    const guards = guardStages(rule.when);
    let sources: string[];
    if (rule.on === "plan" && eventOf(rule) === "created") {
      sources = ["start"];
    } else if (me && (MILESTONES as readonly string[]).includes(me.milestone)) {
      sources = [milestoneNode(me.milestone).id];
    } else if (guards.length > 0) {
      sources = guards.map(stageNode);
    } else {
      sources = [add({ id: "any", kind: "any", value: null, x: 0, y: ROW_MILESTONES + 170 }).id];
    }

    const notes = rule.then
      .filter((a) => a.type === "closeMandates")
      .map((a) => a.type);

    rule.then.forEach((a, i) => {
      if (a.type === "closeMandates") return;
      for (const source of sources) {
        let target: string;
        switch (a.type) {
          case "advance":
          case "start":
          case "close":
            target = a.value ? stageNode(a.value) : source;
            break;
          case "completeTrip":
            target = add({ id: "end", kind: "end", value: null, x: endX, y: ROW_MAIN }).id;
            break;
          case "cancelTrip":
            target = add({ id: "cancelled", kind: "cancelled", value: a.value, x: endX, y: ROW_MILESTONES }).id;
            break;
          case "requestConfirmation": {
            const n = milestoneNode(a.value ?? "?");
            n.ruleKeys.push(rule.key);
            target = n.id;
            break;
          }
          default: {
            // alert and invoke: a flag above where the rule applies.
            const id = `${a.type}:${rule.key}:${i}:${source}`;
            const k = alertsPerSource.get(source) ?? 0;
            alertsPerSource.set(source, k + 1);
            const n = add({ id, kind: "alert", value: a.value, x: 0, y: 0 });
            n.ruleKeys.push(rule.key);
            // Placed once the source has its position.
            Object.assign(n, { anchor: source, slot: k });
            target = id;
          }
        }
        edges.push({
          id: `${rule.key}:${i}:${source}`,
          source,
          target,
          ruleKey: rule.key,
          ruleName: rule.name,
          on: rule.on,
          event: eventOf(rule),
          guard: guardOf(rule),
          action: a.type,
          active: rule.active,
          notes,
        });
      }
    });
  }

  // Milestones sit below the gap their confirmation crosses: just before the
  // stage (or end) it leads to; without one, just after the stage that asks.
  const placed = (id: string) => nodes.get(id)!;
  const isStep = (id: string) => ["stage", "end"].includes(placed(id).kind);
  for (const n of nodes.values()) {
    if (n.kind !== "milestone") continue;
    const leadsTo = edges.filter((e) => e.source === n.id && isStep(e.target)).map((e) => placed(e.target).x);
    const askedFrom = edges.filter((e) => e.target === n.id && isStep(e.source)).map((e) => placed(e.source).x);
    if (leadsTo.length > 0) {
      n.x = Math.min(...leadsTo) - COL / 2;
    } else if (askedFrom.length > 0) {
      n.x = Math.max(...askedFrom) + COL / 2;
    } else {
      const order = (MILESTONES as readonly string[]).indexOf(n.value ?? "");
      n.x = ((order + 1) / (MILESTONES.length + 1)) * endX;
    }
  }
  // Two milestones never share a spot.
  const taken: number[] = [];
  for (const n of [...nodes.values()].filter((x) => x.kind === "milestone").sort((a, b) => a.x - b.x)) {
    while (taken.some((t) => Math.abs(t - n.x) < 200)) n.x += 200;
    taken.push(n.x);
  }
  const anyNode = nodes.get("any");
  if (anyNode) anyNode.x = -COL / 2;
  // Alerts stack above a stage, and in a row below a milestone or "any stage".
  for (const n of nodes.values()) {
    const { anchor, slot } = n as GraphNode & { anchor?: string; slot?: number };
    if (n.kind !== "alert" || !anchor) continue;
    const a = placed(anchor);
    if (a.kind === "stage") {
      n.x = a.x + 10;
      n.y = ROW_ALERTS - (slot ?? 0) * 60;
    } else {
      n.x = a.x + (slot ?? 0) * 210;
      n.y = a.y + 150;
    }
  }

  return { nodes: [...nodes.values()], edges };
}
