import { describe, expect, it } from "vitest";
import { decideReplan } from "./task-driven-replan";

const SLOT = { date: "2026-07-30", hour: 14, minutes: 30 };

function input(overrides: Partial<Parameters<typeof decideReplan>[0]> = {}) {
  return {
    stage: "presentDriver" as const,
    calendarId: "cal-1",
    slot: SLOT,
    ...overrides,
  };
}

describe("decideReplan", () => {
  it("re-plans a presented service with the single remove-assignment edge", () => {
    // presentDriver → assignDriver is the same edge "Eliminar Asignación"
    // uses, so the driver is dropped. That is the agreed trade: moving the
    // date means re-confirming who drives it.
    const plan = decideReplan(input());
    expect(plan?.edges).toHaveLength(1);
    expect(plan?.edges[0]).toMatchObject({
      fromStage: "presentDriver",
      transition: "Asignar Conductor/Transporte",
    });
  });

  it("carries the new slot so ECM re-slots rather than re-asserting the old one", () => {
    // The slot vars are the whole point: OnCreateAssignDriverBinding reads them
    // on the assignDriver create and enqueues ensure(PLANNED, <new slot>).
    const vars = decideReplan(input())?.edges[0].processVariables;
    expect(vars).toMatchObject({
      calendar_id: "cal-1",
      slot_date: "2026-07-30",
      slot_hour: "14",
      slot_minutes: "30",
    });
  });

  it("goes out to planService and back for stages with no direct edge", () => {
    for (const stage of ["assignDriver", "prepareService"] as const) {
      const plan = decideReplan(input({ stage }));
      expect(plan?.edges, stage).toHaveLength(2);
      expect(plan?.edges[0]).toMatchObject({
        fromStage: stage,
        transition: "Planificar Servicio",
      });
      // Only the re-entry carries the slot — the way out is a plain back-edge.
      expect(plan?.edges[0].processVariables).toBeUndefined();
      expect(plan?.edges[1]).toMatchObject({
        fromStage: "planService",
        transition: "Asignar Conductor/Transporte",
      });
      expect(plan?.edges[1].processVariables).toBeDefined();
    }
  });

  it("passes the service category through when set", () => {
    const vars = decideReplan(input({ serviceCategory: "ST001" }))?.edges[0]
      .processVariables;
    expect(vars?.mintral_serviceCategory).toBe("ST001");
  });

  it("refuses once the trip has started", () => {
    for (const stage of ["missionControl", "monitorTrip"] as const) {
      expect(decideReplan(input({ stage })), stage).toBeNull();
    }
  });

  it("has nothing to re-plan at planService", () => {
    // Not planned yet — there is no booking to re-slot.
    expect(decideReplan(input({ stage: "planService" }))).toBeNull();
  });

  it("returns null without a stage or a calendar", () => {
    expect(decideReplan(input({ stage: undefined }))).toBeNull();
    expect(decideReplan(input({ calendarId: undefined }))).toBeNull();
  });
});
