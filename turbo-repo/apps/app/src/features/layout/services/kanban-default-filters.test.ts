import { describe, it, expect } from "vitest";
import {
  defaultPlannerSourceFor,
  defaultServiceTypeFor,
  FILTER_ANY,
} from "./kanban-default-filters";

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

describe("defaultPlannerSourceFor", () => {
  const PLANNER = "/es/calendar/cal-1/planning";

  it("opens the planner on the calendar's own work", () => {
    expect(defaultPlannerSourceFor(PLANNER, null)).toBe("miot");
  });

  it("leaves a choice the operator already made", () => {
    expect(defaultPlannerSourceFor(PLANNER, "miot")).toBeUndefined();
    expect(defaultPlannerSourceFor(PLANNER, "synced")).toBeUndefined();
  });

  it("leaves the operator's everything choice alone", () => {
    // Without the sentinel, landing would put the default straight back and
    // "Todos" would be unreachable.
    expect(defaultPlannerSourceFor(PLANNER, FILTER_ANY)).toBeUndefined();
  });

  it("replaces a value no filter can be made of", () => {
    expect(defaultPlannerSourceFor(PLANNER, "")).toBe("miot");
    expect(defaultPlannerSourceFor(PLANNER, "MIOT")).toBe("miot");
    expect(defaultPlannerSourceFor(PLANNER, "alerce")).toBe("miot");
  });

  it("leaves every other section alone", () => {
    // Including the kanban's own planning board, which shares the last
    // segment with the calendar planner and reads no `source`.
    expect(defaultPlannerSourceFor("/es/planning", null)).toBeUndefined();
    expect(defaultPlannerSourceFor("/es/shipping", null)).toBeUndefined();
    expect(defaultPlannerSourceFor("/es/calendar", null)).toBeUndefined();
  });
});
