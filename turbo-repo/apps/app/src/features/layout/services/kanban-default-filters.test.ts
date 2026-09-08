import { describe, it, expect } from "vitest";
import { defaultServiceTypeFor } from "./kanban-default-filters";

describe("defaultServiceTypeFor", () => {
  it("names a type for a kanban section that carries none", () => {
    expect(defaultServiceTypeFor("/es/shipping", false)).toBe("v");
    expect(defaultServiceTypeFor("/app/es/mytasks", false)).toBe("v");
    expect(defaultServiceTypeFor("/es/finished", false)).toBe("v");
  });

  it("leaves a URL that already names one alone", () => {
    expect(defaultServiceTypeFor("/es/shipping", true)).toBeUndefined();
  });

  it("leaves the calendar planner to its own calendar's type", () => {
    expect(
      defaultServiceTypeFor("/es/calendar/cal-1/planning", false)
    ).toBeUndefined();
  });

  it("leaves sections that have no service type alone", () => {
    expect(defaultServiceTypeFor("/es/symptoms", false)).toBeUndefined();
    expect(defaultServiceTypeFor("/es/fleet-management", false)).toBeUndefined();
    expect(defaultServiceTypeFor("/es", false)).toBeUndefined();
  });
});
