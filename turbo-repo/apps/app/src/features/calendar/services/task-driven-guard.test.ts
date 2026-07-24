import { describe, expect, it } from "vitest";
import {
  canAssignAtStage,
  canReplanAtStage,
  refuseAssign,
  refuseReplan,
  refuseWorkflowlessPlan,
} from "./task-driven-guard";

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

describe("canAssignAtStage", () => {
  it("allows the two stages the assign edge connects", () => {
    expect(canAssignAtStage("assignDriver", "SCL", ORIGINS)).toBe(true);
    expect(canAssignAtStage("presentDriver", "SCL", ORIGINS)).toBe(true);
  });

  it("refuses stages with no edge to carry a resource change", () => {
    // The 1625094 / 1524620 case: planned long ago, now at missionControl —
    // planning and assigning are different steps, and this one is past both.
    expect(canAssignAtStage("missionControl", "SCL", ORIGINS)).toBe(false);
    expect(canAssignAtStage("prepareService", "SCL", ORIGINS)).toBe(false);
    // Not yet planned: assigning is not the gesture that plans it.
    expect(canAssignAtStage("planService", "SCL", ORIGINS)).toBe(false);
  });

  it("refuses the terminal stages a booking row can carry", () => {
    expect(canAssignAtStage("finished", "SCL", ORIGINS)).toBe(false);
    expect(canAssignAtStage("cancelled", "SCL", ORIGINS)).toBe(false);
  });

  it("fails open on what it cannot prove", () => {
    // Flag-off origin — ECM owns nothing there.
    expect(canAssignAtStage("missionControl", "IQQ", ORIGINS)).toBe(true);
    // Stage unknown: the live task index is still loading. Hiding the action
    // on every chip during that window would be worse than a late refusal.
    expect(canAssignAtStage(undefined, "SCL", ORIGINS)).toBe(true);
  });
});

describe("refuseAssign", () => {
  function assignInput(
    overrides: Partial<Parameters<typeof refuseAssign>[0]> = {}
  ) {
    return {
      stage: "assignDriver" as const,
      origin: "SCL",
      enabledOrigins: ORIGINS,
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

  it("leaves flag-off origins and unknown stages alone", () => {
    expect(
      refuseAssign(
        assignInput({
          stage: "missionControl",
          origin: "IQQ",
          hasTaskAdvance: false,
        })
      )
    ).toBeNull();
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
      expect(canReplanAtStage(stage, "SCL", ORIGINS), stage).toBe(true);
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
      expect(canReplanAtStage(stage, "SCL", ORIGINS), stage).toBe(false);
    }
  });

  it("refuses the terminal states a booking row can carry", () => {
    expect(canReplanAtStage("finished", "SCL", ORIGINS)).toBe(false);
    expect(canReplanAtStage("cancelled", "SCL", ORIGINS)).toBe(false);
  });

  it("fails open on what it cannot prove", () => {
    expect(canReplanAtStage("missionControl", "IQQ", ORIGINS)).toBe(true);
    expect(canReplanAtStage(undefined, "SCL", ORIGINS)).toBe(true);
  });
});

describe("refuseReplan", () => {
  const base = { origin: "SCL", enabledOrigins: ORIGINS };

  it("allows the replannable stages", () => {
    expect(refuseReplan({ ...base, stage: "presentDriver" })).toBeNull();
    expect(refuseReplan({ ...base, stage: "prepareService" })).toBeNull();
  });

  it("refuses past the trip start, naming the stage", () => {
    // Service 1625094: the case that started this.
    const reason = refuseReplan({ ...base, stage: "missionControl" });
    expect(reason).toContain("missionControl");
    expect(reason).toContain("No se puede replanificar");
  });

  it("leaves flag-off origins and unknown stages alone", () => {
    expect(
      refuseReplan({ ...base, origin: "IQQ", stage: "missionControl" })
    ).toBeNull();
    expect(refuseReplan({ ...base, stage: undefined })).toBeNull();
  });
});
