import { describe, expect, it } from "vitest";
import {
  assignmentIncomplete,
  assignmentOverrides,
  normalizeTrailerNeed,
  trailerRequired,
} from "./assignment-rules";
import type { AssignmentFormData } from "./assignment-form";

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

function formData(overrides: Partial<AssignmentFormData> = {}): AssignmentFormData {
  return {
    carrier: "carrier-1",
    carrierExternalId: "375",
    carrierAccreditation: null,
    driver: "driver-1",
    driverAccreditation: null,
    secondDriver: "",
    secondDriverAccreditation: null,
    hasSecondDriver: false,
    truck: "truck-1",
    truckAccreditation: null,
    trailer: "",
    trailerAccreditation: null,
    truckTrailerNeed: null,
    ...overrides,
  };
}

describe("assignmentOverrides", () => {
  it("writes the filled slots", () => {
    const out = assignmentOverrides(
      formData({ trailer: "trailer-1", truckTrailerNeed: true })
    );
    expect(out.assignedCarrier).toBe("carrier-1");
    expect(out.assignedDriver).toBe("driver-1");
    expect(out.assignedTruck).toBe("truck-1");
    expect(out.assignedTrailer).toBe("trailer-1");
  });

  it("explicitly clears the trailer of a trailerless truck", () => {
    // The prod-job-2123fcea shape: previous assignment had a trailer, the new
    // truck runs without one. Omitting the key would let the stale trailer
    // ride the merged service state into the dispatch.
    const out = assignmentOverrides(formData({ truckTrailerNeed: false }));
    expect(out.assignedTrailer).toBe("");
    expect(out.assignedTrailerAccreditation).toBeNull();
  });

  it("leaves a pending required trailer untouched", () => {
    // Trailer-needing truck, trailer not picked yet: a partial fill, not a
    // statement — don't wipe what a previous confirm saved.
    const out = assignmentOverrides(formData({ truckTrailerNeed: true }));
    expect(out).not.toHaveProperty("assignedTrailer");
  });

  it("leaves the trailer untouched while the flag is unknown", () => {
    const out = assignmentOverrides(formData({ truckTrailerNeed: null }));
    expect(out).not.toHaveProperty("assignedTrailer");
  });

  it("explicitly clears a closed second-driver section", () => {
    const out = assignmentOverrides(formData({ hasSecondDriver: false }));
    expect(out.assignedDriver2).toBe("");
    expect(out.assignedDriver2Accreditation).toBeNull();
  });

  it("leaves an open-but-empty second-driver section untouched", () => {
    const out = assignmentOverrides(
      formData({ hasSecondDriver: true, secondDriver: "" })
    );
    expect(out).not.toHaveProperty("assignedDriver2");
  });

  it("writes a picked second driver", () => {
    const out = assignmentOverrides(
      formData({ hasSecondDriver: true, secondDriver: "driver-2" })
    );
    expect(out.assignedDriver2).toBe("driver-2");
  });

  it("preserves a null carrier external id as a real value", () => {
    const out = assignmentOverrides(formData({ carrierExternalId: null }));
    expect(out).toHaveProperty("assignedCarrierExternalId", null);
  });
});
