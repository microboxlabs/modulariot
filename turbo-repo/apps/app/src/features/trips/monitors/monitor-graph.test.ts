import { describe, expect, it } from "vitest";
import { buildGraph, guardOf, guardStages } from "./monitor-graph";
import type { MonitorBody, Rule } from "./monitors-api";

const rule = (r: Partial<Rule> & Pick<Rule, "key" | "on" | "then">): Rule => ({
  name: null,
  at: null,
  when: null,
  priority: 50,
  active: true,
  ...r,
});

const body: MonitorBody = {
  name: "Example",
  description: null,
  plan: [
    { stageType: "preparation", serviceStatus: "ADDED" },
    { stageType: "transit", serviceStatus: "SCHEDULED" },
    { stageType: "closing", serviceStatus: "CLOSED" },
  ],
  params: { etaArrivalMinutes: 240 },
  scope: { feeds: ["example"], orderTypes: [], origins: [], destinations: [] },
  rules: [
    rule({ key: "plan-start", on: "plan", when: 'event.kind == "created"', then: [{ type: "start", value: "preparation" }] }),
    rule({
      key: "left-origin",
      on: "signal",
      when: 'signal.kind == "left_origin" && milestones.departure.status != "confirmed"',
      then: [{ type: "alert", value: "departure_unauthorized" }],
    }),
    rule({
      key: "entered-destination",
      on: "signal",
      when: 'signal.kind == "entered_destination"',
      then: [
        { type: "alert", value: "gps_arrival" },
        { type: "requestConfirmation", value: "arrival" },
      ],
    }),
    rule({
      key: "eta-arrival",
      on: "timer",
      at: "trip.plannedEnd + minutes(params.etaArrivalMinutes)",
      when: 'stage.type == "transit" && milestones.arrival.status != "confirmed"',
      then: [{ type: "requestConfirmation", value: "arrival" }],
    }),
    rule({
      key: "departure-confirmed",
      on: "command",
      when: 'event.kind == "departure_confirmed" && stage.type == "preparation"',
      then: [{ type: "advance", value: "transit" }],
    }),
    rule({
      key: "closure-confirmed",
      on: "command",
      when: 'event.kind == "closure_confirmed"',
      then: [{ type: "completeTrip", value: null }, { type: "closeMandates", value: null }],
    }),
  ],
} as MonitorBody;

describe("buildGraph", () => {
  const g = buildGraph(body);
  const edge = (key: string) => g.edges.filter((e) => e.ruleKey === key);

  it("draws the plan as stages in order between start and end", () => {
    const stages = g.nodes.filter((n) => n.kind === "stage");
    expect(stages.map((n) => n.value)).toEqual(["preparation", "transit", "closing"]);
    expect(stages[0].x).toBeLessThan(stages[1].x);
    expect(g.nodes.find((n) => n.kind === "end")).toBeTruthy();
  });

  it("starts the first stage when the plan is created", () => {
    expect(edge("plan-start")).toMatchObject([{ source: "start", target: "stage:preparation" }]);
  });

  it("sends a confirmed milestone to the stage its rule advances to", () => {
    expect(edge("departure-confirmed")).toMatchObject([
      { source: "milestone:departure", target: "stage:transit", guard: null },
    ]);
  });

  it("asks for the arrival from the transit timer and from the unguarded signal", () => {
    expect(edge("eta-arrival")).toMatchObject([
      { source: "stage:transit", target: "milestone:arrival", event: "trip.plannedEnd + minutes(params.etaArrivalMinutes)" },
    ]);
    expect(edge("entered-destination").map((e) => [e.source, e.action])).toEqual([
      ["any", "alert"],
      ["any", "requestConfirmation"],
    ]);
  });

  it("completes the trip and keeps closeMandates as a note", () => {
    expect(edge("closure-confirmed")).toMatchObject([
      { source: "milestone:closure", target: "end", notes: ["closeMandates"] },
    ]);
  });

  it("puts each alert in its own node", () => {
    expect(g.nodes.filter((n) => n.kind === "alert").map((n) => n.value).sort()).toEqual([
      "departure_unauthorized",
      "gps_arrival",
    ]);
  });
});

describe("conditions", () => {
  it("reads the stage tests", () => {
    expect(guardStages('event.kind == "x" && (stage.type == "a" || stage.type == "b")')).toEqual(["a", "b"]);
  });
  it("keeps only what is not the event or the stage", () => {
    expect(
      guardOf(rule({ key: "k", on: "signal", when: 'signal.kind == "left_origin" && milestones.departure.status != "confirmed"', then: [] }))
    ).toBe('milestones.departure.status != "confirmed"');
    expect(guardOf(rule({ key: "k", on: "command", when: 'event.kind == "x" && stage.type == "a"', then: [] }))).toBeNull();
  });
});
