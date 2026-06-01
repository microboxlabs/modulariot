import { describe, it, expect } from "vitest";
import {
  decideUnassignBindingNotification,
  decideUnplanBindingNotification,
} from "./task-driven-binding-gate";

const FLAG_ON = new Set(["ANTOFAGASTA"]);
const FLAG_OFF = new Set<string>();

describe("decideUnplanBindingNotification — P2 unplan flag gating", () => {
  it("flag ON: returns null for a task-driven origin (no binding call)", () => {
    expect(
      decideUnplanBindingNotification(
        "SVC-001",
        "cal-001",
        "ANTOFAGASTA",
        FLAG_ON
      )
    ).toBeNull();
  });

  it("flag OFF: returns the stage:none payload for a non-task-driven origin", () => {
    expect(
      decideUnplanBindingNotification("SVC-001", "cal-001", "CALAMA", FLAG_ON)
    ).toEqual({
      numero_servicio: "SVC-001",
      calendar_id: "cal-001",
      stage: "none",
    });
  });

  it("empty enabled set: every origin treated as flag-off (default)", () => {
    expect(
      decideUnplanBindingNotification(
        "SVC-001",
        "cal-001",
        "ANTOFAGASTA",
        FLAG_OFF
      )
    ).toEqual({
      numero_servicio: "SVC-001",
      calendar_id: "cal-001",
      stage: "none",
    });
  });

  it("returns null when the service has no business code", () => {
    expect(
      decideUnplanBindingNotification(undefined, "cal-001", "CALAMA", FLAG_ON)
    ).toBeNull();
  });

  it("returns null when no calendar is in scope", () => {
    expect(
      decideUnplanBindingNotification("SVC-001", undefined, "CALAMA", FLAG_ON)
    ).toBeNull();
  });

  it("unknown origin: treated as flag-off (returns payload)", () => {
    expect(
      decideUnplanBindingNotification(
        "SVC-001",
        "cal-001",
        "UNKNOWN_CODE",
        FLAG_ON
      )
    ).toEqual({
      numero_servicio: "SVC-001",
      calendar_id: "cal-001",
      stage: "none",
    });
  });

  it("missing origin on the service: treated as flag-off (returns payload)", () => {
    expect(
      decideUnplanBindingNotification("SVC-001", "cal-001", undefined, FLAG_ON)
    ).toEqual({
      numero_servicio: "SVC-001",
      calendar_id: "cal-001",
      stage: "none",
    });
  });
});

describe("decideUnassignBindingNotification — P3 unassign flag gating", () => {
  it("flag ON: returns null for a task-driven origin (no binding call)", () => {
    expect(
      decideUnassignBindingNotification(
        "SVC-001",
        "cal-001",
        "ANTOFAGASTA",
        FLAG_ON
      )
    ).toBeNull();
  });

  it("flag OFF: returns the stage:unassigned payload (unchanged)", () => {
    expect(
      decideUnassignBindingNotification(
        "SVC-001",
        "cal-001",
        "CALAMA",
        FLAG_ON
      )
    ).toEqual({
      numero_servicio: "SVC-001",
      calendar_id: "cal-001",
      stage: "unassigned",
    });
  });

  it("empty enabled set: every origin treated as flag-off (default)", () => {
    expect(
      decideUnassignBindingNotification(
        "SVC-001",
        "cal-001",
        "ANTOFAGASTA",
        FLAG_OFF
      )
    ).toEqual({
      numero_servicio: "SVC-001",
      calendar_id: "cal-001",
      stage: "unassigned",
    });
  });

  it("returns null when the service has no business code", () => {
    expect(
      decideUnassignBindingNotification(undefined, "cal-001", "CALAMA", FLAG_ON)
    ).toBeNull();
  });

  it("returns null when no calendar is in scope", () => {
    expect(
      decideUnassignBindingNotification(
        "SVC-001",
        undefined,
        "CALAMA",
        FLAG_ON
      )
    ).toBeNull();
  });

  it("unknown origin: treated as flag-off (returns payload)", () => {
    expect(
      decideUnassignBindingNotification(
        "SVC-001",
        "cal-001",
        "UNKNOWN_CODE",
        FLAG_ON
      )
    ).toEqual({
      numero_servicio: "SVC-001",
      calendar_id: "cal-001",
      stage: "unassigned",
    });
  });
});
