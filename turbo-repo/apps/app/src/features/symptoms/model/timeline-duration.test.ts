import { describe, expect, it } from "vitest";
import type { ConditionsAgg, TimelineElement } from "../types/timeline";
import { timelineDurationMinutes } from "./timeline-duration";

function steppedCase(symptomId: number): TimelineElement {
  const bounds = [
    [0, 4200],
    [4200, 7800],
    [7800, 9600],
    [9600, 10600],
  ] as const;
  const start = Date.parse("2026-10-22T02:50:00Z");
  const at = (seconds: number) =>
    new Date(start + seconds * 1000).toISOString();
  const conditions: ConditionsAgg[] = bounds.map(([from, to], i) => ({
    start: at(from),
    end: at(to),
    symptom_id: symptomId,
    assigned_to: "",
    icu_code: String(i + 1),
    is_symptom: 1,
    icu_condition: "CODE YELLOW",
    count: 1,
    symptom_description: "Signal loss",
    treatments: [],
    type: "Signal loss",
    evidences: null,
  }));
  return {
    start: at(0),
    end: at(10600),
    symptom_id: symptomId,
    conditions_agg: conditions,
  };
}

describe("timelineDurationMinutes", () => {
  it("shows the full engine case duration across its level steps", () => {
    expect(timelineDurationMinutes(steppedCase(-12))).toBe(176);
  });

  it("keeps the longest condition duration for legacy symptoms", () => {
    expect(timelineDurationMinutes(steppedCase(12))).toBe(70);
  });

  it("keeps an empty legacy group at zero minutes", () => {
    expect(timelineDurationMinutes({ start: "", end: "" })).toBe(0);
  });
});
