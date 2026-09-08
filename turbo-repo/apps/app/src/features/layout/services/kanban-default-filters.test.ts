import { describe, it, expect } from "vitest";
import { defaultServiceTypeFor, FILTER_ANY } from "./kanban-default-filters";

describe("defaultServiceTypeFor", () => {
  it("names a type for a kanban section that carries none", () => {
    expect(defaultServiceTypeFor("/es/shipping", null)).toBe("v");
    expect(defaultServiceTypeFor("/app/es/mytasks", null)).toBe("v");
    expect(defaultServiceTypeFor("/es/finished", undefined)).toBe("v");
  });

  it("leaves a URL that already names a type alone", () => {
    expect(defaultServiceTypeFor("/es/shipping", "v")).toBeUndefined();
    expect(defaultServiceTypeFor("/es/shipping", "otr")).toBeUndefined();
    expect(defaultServiceTypeFor("/es/shipping", "OTE")).toBeUndefined();
  });

  it("leaves the operator's every-type choice alone", () => {
    expect(defaultServiceTypeFor("/es/shipping", FILTER_ANY)).toBeUndefined();
  });

  it("replaces a value no filter can be made of", () => {
    // The API drops these; left in the URL they would sit under a badge
    // claiming to filter by them.
    expect(defaultServiceTypeFor("/es/shipping", "")).toBe("v");
    expect(defaultServiceTypeFor("/es/shipping", "   ")).toBe("v");
    expect(defaultServiceTypeFor("/es/shipping", "xyz")).toBe("v");
    expect(defaultServiceTypeFor("/es/shipping", "v,otr")).toBe("v");
  });

  it("leaves the calendar planner to its own calendar's type", () => {
    expect(
      defaultServiceTypeFor("/es/calendar/cal-1/planning", null)
    ).toBeUndefined();
  });

  it("leaves sections that have no service type alone", () => {
    expect(defaultServiceTypeFor("/es/symptoms", null)).toBeUndefined();
    expect(defaultServiceTypeFor("/es/fleet-management", "xyz")).toBeUndefined();
    expect(defaultServiceTypeFor("/es", null)).toBeUndefined();
  });
});
