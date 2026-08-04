import { describe, expect, it } from "vitest";
import {
  canAssignAtStage,
  canReplanAtStage,
  refuseAssign,
  refuseReplan,
  refuseWorkflowlessPlan,
} from "./task-driven-guard";

function input(overrides: Partial<Parameters<typeof refuseWorkflowlessPlan>[0]> = {}) {
  return {
    stage: "presentDriver" as const,
    hasTaskAdvance: false,
    hasReassign: false,
    isReassigning: false,
    ...overrides,
  };
}

describe("refuseWorkflowlessPlan", () => {
  it("refuses a service whose task sits past the plannable stages", () => {
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

  it("leaves a service with no live task alone", () => {
    // We cannot prove it is workflow-backed; refusing would block planning for
    // services whose workflow is genuinely missing, which is a separate bug.
    expect(refuseWorkflowlessPlan(input({ stage: undefined }))).toBeNull();
  });

});

describe("canAssignAtStage", () => {
  it("allows the two stages the assign edge connects", () => {
    expect(canAssignAtStage("assignDriver")).toBe(true);
    expect(canAssignAtStage("presentDriver")).toBe(true);
  });

  it("refuses stages with no edge to carry a resource change", () => {
    // The 1625094 / 1524620 case: planned long ago, now at missionControl —
    // planning and assigning are different steps, and this one is past both.
    expect(canAssignAtStage("missionControl")).toBe(false);
    expect(canAssignAtStage("prepareService")).toBe(false);
    // Not yet planned: assigning is not the gesture that plans it.
    expect(canAssignAtStage("planService")).toBe(false);
  });

  it("refuses the terminal stages a booking row can carry", () => {
    expect(canAssignAtStage("finished")).toBe(false);
    expect(canAssignAtStage("cancelled")).toBe(false);
  });

  it("fails open on an unknown stage", () => {
    // The live task index is still loading. Hiding the action on every chip
    // during that window would be worse than a late refusal.
    expect(canAssignAtStage(undefined)).toBe(true);
  });
});

describe("refuseAssign", () => {
  function assignInput(
    overrides: Partial<Parameters<typeof refuseAssign>[0]> = {}
  ) {
    return {
      stage: "assignDriver" as const,
      hasTaskAdvance: true,
      hasReassign: false,
      ...overrides,
    };
  }

  it("allows the forward assign edge", () => {
    expect(refuseAssign(assignInput())).toBeNull();
  });

  it("allows the presented-service re-assign dance", () => {
    expect(
      refuseAssign(
        assignInput({
          stage: "presentDriver",
          hasTaskAdvance: false,
          hasReassign: true,
        })
      )
    ).toBeNull();
  });

  it("refuses past the assign edge, naming the stage", () => {
    const reason = refuseAssign(
      assignInput({ stage: "missionControl", hasTaskAdvance: false })
    );
    expect(reason).toContain("missionControl");
    expect(reason).toContain("No se puede asignar");
  });

  it("refuses an incomplete tuple at an assignable stage", () => {
    // presentDriver with nothing resolved: `buildAssignProcessVariables`
    // returned null, so a write would move no workflow.
    const reason = refuseAssign(
      assignInput({ stage: "presentDriver", hasTaskAdvance: false })
    );
    expect(reason).toContain("faltan datos");
  });

  it("leaves unknown stages alone", () => {
    expect(
      refuseAssign(assignInput({ stage: undefined, hasTaskAdvance: false }))
    ).toBeNull();
  });
});

describe("canReplanAtStage", () => {
  it("allows re-planning right up to the trip start", () => {
    // Erick's rule: replan until missionControl. prepareService still counts —
    // the trip has not started there.
    for (const stage of [
      "planService",
      "assignDriver",
      "presentDriver",
      "prepareService",
    ]) {
      expect(canReplanAtStage(stage), stage).toBe(true);
    }
  });

  it("refuses once the trip has started", () => {
    // missionControl is the trip start ("Iniciar Viaje") — past it there is no
    // edge back into assignDriver, so a re-plan has nowhere to go.
    for (const stage of [
      "missionControl",
      "monitorTrip",
      "confirmArrival",
      "closeMonitoring",
    ]) {
      expect(canReplanAtStage(stage), stage).toBe(false);
    }
  });

  it("refuses the terminal states a booking row can carry", () => {
    expect(canReplanAtStage("finished")).toBe(false);
    expect(canReplanAtStage("cancelled")).toBe(false);
  });

  it("fails open on an unknown stage", () => {
    expect(canReplanAtStage(undefined)).toBe(true);
  });
});

describe("refuseReplan", () => {
  it("allows the replannable stages", () => {
    expect(refuseReplan({ stage: "presentDriver" })).toBeNull();
    expect(refuseReplan({ stage: "prepareService" })).toBeNull();
  });

  it("refuses past the trip start, naming the stage", () => {
    // Service 1625094: the case that started this.
    const reason = refuseReplan({ stage: "missionControl" });
    expect(reason).toContain("missionControl");
    expect(reason).toContain("No se puede replanificar");
  });

  it("leaves unknown stages alone", () => {
    expect(refuseReplan({ stage: undefined })).toBeNull();
  });
});
