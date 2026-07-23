import { describe, expect, it } from "vitest";
import { refuseWorkflowlessPlan } from "./task-driven-guard";

const ORIGINS = new Set(["SCL", "ANF"]);

function input(overrides: Partial<Parameters<typeof refuseWorkflowlessPlan>[0]> = {}) {
  return {
    stage: "presentDriver" as const,
    origin: "SCL",
    enabledOrigins: ORIGINS,
    hasTaskAdvance: false,
    hasReassign: false,
    isReassigning: false,
    ...overrides,
  };
}

describe("refuseWorkflowlessPlan", () => {
  it("refuses a task-driven service whose task sits past the plannable stages", () => {
    // The 78265602 case: SCL, live task at presentDriver, no transition
    // resolves — today this silently wrote a booking with no workflow move.
    const reason = refuseWorkflowlessPlan(input());
    expect(reason).toContain("presentDriver");
    expect(reason).toContain("No se puede planificar");
  });

  it("refuses at every stage the transition table does not cover", () => {
    for (const stage of ["presentDriver", "prepareService", "missionControl"] as const) {
      expect(refuseWorkflowlessPlan(input({ stage })), stage).not.toBeNull();
    }
  });

  it("allows the gestures that do move the workflow", () => {
    // A resolved forward transition (planService / assignDriver)…
    expect(refuseWorkflowlessPlan(input({ hasTaskAdvance: true }))).toBeNull();
    // …and the presented-service re-assign dance, which drives two edges.
    expect(refuseWorkflowlessPlan(input({ hasReassign: true }))).toBeNull();
  });

  it("allows a slot-only move", () => {
    // Reassignment changes the cell, not the stage — the workflow is already
    // where it belongs, so there is nothing to refuse.
    expect(refuseWorkflowlessPlan(input({ isReassigning: true }))).toBeNull();
  });

  it("leaves flag-off origins alone", () => {
    // ECM does not own the booking lifecycle there, so a direct write is the
    // correct behaviour, not a divergence.
    expect(refuseWorkflowlessPlan(input({ origin: "IQQ" }))).toBeNull();
    expect(refuseWorkflowlessPlan(input({ origin: undefined }))).toBeNull();
    expect(
      refuseWorkflowlessPlan(input({ enabledOrigins: new Set() }))
    ).toBeNull();
  });

  it("leaves a service with no live task alone", () => {
    // We cannot prove it is workflow-backed; refusing would block planning for
    // services whose workflow is genuinely missing, which is a separate bug.
    expect(refuseWorkflowlessPlan(input({ stage: undefined }))).toBeNull();
  });

  it("is case-sensitive on the origin, like every other task-driven helper", () => {
    expect(refuseWorkflowlessPlan(input({ origin: "scl" }))).toBeNull();
  });
});
