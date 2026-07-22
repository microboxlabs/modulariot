import { describe, expect, it } from "vitest";
import { resolveSection, segmentsOf } from "./resolve-section";

const section = (pathname: string) => resolveSection(segmentsOf(pathname));

describe("resolveSection", () => {
  it("resolves calendar planning routes away from the kanban 'planning' key", () => {
    // The regression this exists for: both of these end in `planning`, which is
    // a registered kanban board, so the calendar used to render kanban filters.
    expect(section("/es/calendar/9f3c-uuid/planning")).toBe("calendar-planning");
    expect(section("/es/calendar/planning")).toBe("calendar-planning");
  });

  it("leaves the kanban planning board alone", () => {
    expect(section("/es/planning")).toBe("planning");
  });

  it("keeps the bare calendar landing page bar-less", () => {
    // `calendar` is not a registry key — only the synthetic `calendar-planning`
    // is — so the landing page resolves to something unregistered.
    expect(section("/es/calendar")).toBe("calendar");
  });

  it("passes other sections through as the last segment", () => {
    expect(section("/es/shipping")).toBe("shipping");
    expect(section("/es/mytasks")).toBe("mytasks");
    expect(section("/es/fleet-management/ABCD12")).toBe("ABCD12");
  });

  it("is locale-agnostic", () => {
    expect(section("/en/calendar/9f3c-uuid/planning")).toBe("calendar-planning");
    expect(section("/en/planning")).toBe("planning");
  });

  it("handles a trailing slash", () => {
    expect(section("/es/calendar/9f3c-uuid/planning/")).toBe("calendar-planning");
  });

  it("returns undefined for an empty path", () => {
    expect(section("/")).toBeUndefined();
  });
});
