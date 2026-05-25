import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { decideUnplanBindingNotification } from "./task-driven-binding-gate";

const ENV_KEY = "NEXT_PUBLIC_TASK_DRIVEN_ORIGINS";

describe("decideUnplanBindingNotification — P2 unplan flag gating", () => {
  const original = process.env[ENV_KEY];

  beforeEach(() => {
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  });

  it("flag ON: returns null for a task-driven origin (no binding call)", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA";
    expect(
      decideUnplanBindingNotification("SVC-001", "cal-001", "ANTOFAGASTA")
    ).toBeNull();
  });

  it("flag OFF: returns the stage:none payload for a non-task-driven origin (unchanged)", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA";
    expect(
      decideUnplanBindingNotification("SVC-001", "cal-001", "CALAMA")
    ).toEqual({
      numero_servicio: "SVC-001",
      calendar_id: "cal-001",
      stage: "none",
    });
  });

  it("env unset: every origin treated as flag-off (default)", () => {
    expect(
      decideUnplanBindingNotification("SVC-001", "cal-001", "ANTOFAGASTA")
    ).toEqual({
      numero_servicio: "SVC-001",
      calendar_id: "cal-001",
      stage: "none",
    });
  });

  it("returns null when the service has no business code", () => {
    expect(
      decideUnplanBindingNotification(undefined, "cal-001", "CALAMA")
    ).toBeNull();
  });

  it("returns null when no calendar is in scope", () => {
    expect(
      decideUnplanBindingNotification("SVC-001", undefined, "CALAMA")
    ).toBeNull();
  });

  it("unknown origin: treated as flag-off (returns payload)", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA";
    expect(
      decideUnplanBindingNotification("SVC-001", "cal-001", "UNKNOWN_CODE")
    ).toEqual({
      numero_servicio: "SVC-001",
      calendar_id: "cal-001",
      stage: "none",
    });
  });

  it("missing origin on the service: treated as flag-off (returns payload)", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA";
    expect(
      decideUnplanBindingNotification("SVC-001", "cal-001", undefined)
    ).toEqual({
      numero_servicio: "SVC-001",
      calendar_id: "cal-001",
      stage: "none",
    });
  });
});
