import { describe, expect, it } from "vitest";
import {
  assignmentIncomplete,
  normalizeTrailerNeed,
  trailerRequired,
} from "./assignment-rules";

function selection(
  overrides: Partial<Parameters<typeof assignmentIncomplete>[0]> = {}
) {
  return {
    carrier: "carrier-1",
    driver: "driver-1",
    truck: "truck-1",
    trailer: "",
    truckTrailerNeed: null as boolean | null,
    ...overrides,
  };
}

describe("normalizeTrailerNeed", () => {
  it("maps the fn's 0|1 to booleans", () => {
    expect(normalizeTrailerNeed(1)).toBe(true);
    expect(normalizeTrailerNeed(0)).toBe(false);
  });

  it("admits booleans unchanged", () => {
    expect(normalizeTrailerNeed(true)).toBe(true);
    expect(normalizeTrailerNeed(false)).toBe(false);
  });

  it("keeps absent/null as unknown", () => {
    expect(normalizeTrailerNeed(null)).toBeNull();
    expect(normalizeTrailerNeed(undefined)).toBeNull();
  });
});

describe("trailerRequired", () => {
  it("is required for a truck that needs its trailer", () => {
    expect(trailerRequired(selection({ truckTrailerNeed: true }))).toBe(true);
  });

  it("is hidden (not required) for a trailerless vehicle", () => {
    expect(trailerRequired(selection({ truckTrailerNeed: false }))).toBe(false);
  });

  it("fails closed when the flag is unknown", () => {
    // Row not on the page yet, or an fn deployment that predates the flag —
    // requiring beats dispatching an empty slot a binding fills with a
    // placeholder.
    expect(trailerRequired(selection({ truckTrailerNeed: null }))).toBe(true);
  });

  it("is moot without a truck", () => {
    expect(trailerRequired(selection({ truck: "" }))).toBe(false);
  });
});

describe("assignmentIncomplete", () => {
  it("requires carrier, driver and truck as before", () => {
    expect(assignmentIncomplete(selection({ carrier: "" }))).toBe(true);
    expect(assignmentIncomplete(selection({ driver: "" }))).toBe(true);
    expect(assignmentIncomplete(selection({ truck: "" }))).toBe(true);
  });

  it("blocks a trailer-needing truck until the trailer is picked", () => {
    expect(
      assignmentIncomplete(selection({ truckTrailerNeed: true }))
    ).toBe(true);
    expect(
      assignmentIncomplete(
        selection({ truckTrailerNeed: true, trailer: "trailer-1" })
      )
    ).toBe(false);
  });

  it("lets a trailerless vehicle through without one", () => {
    expect(
      assignmentIncomplete(selection({ truckTrailerNeed: false }))
    ).toBe(false);
  });

  it("blocks while the flag is still unknown", () => {
    expect(assignmentIncomplete(selection())).toBe(true);
  });
});
