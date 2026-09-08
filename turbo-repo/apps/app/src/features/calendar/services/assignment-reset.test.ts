import { describe, it, expect } from "vitest";
import { withAssignmentCleared } from "./assignment-reset";
import type { SelectedService } from "@/features/calendar/components/planning/planning-selection-types";

const ASSIGNED = {
  id: "1658427-V",
  cliente: "ACME",
  plannedIn: "miot",
  assignedIn: "miot",
  assignedCarrier: "carrier-1",
  assignedDriver: "driver-1",
  assignedDriver2: "driver-2",
  assignedTruck: "truck-1",
  assignedTrailer: "trailer-1",
  assignedCarrierAccreditation: "accredited",
  assignedDriverAccreditation: "accredited",
  assignedDriver2Accreditation: "accredited",
  assignedTruckAccreditation: "accredited",
  assignedTrailerAccreditation: "accredited",
} as unknown as SelectedService;

describe("withAssignmentCleared", () => {
  it("drops every field describing the assignment", () => {
    const cleared = withAssignmentCleared(ASSIGNED);
    for (const key of Object.keys(ASSIGNED).filter((k) =>
      k.startsWith("assigned")
    )) {
      expect(cleared[key as keyof SelectedService]).toBeUndefined();
    }
  });

  it("clears the assign stamp", () => {
    // The package PUTs this object back as the booking's resource.data, so a
    // surviving `assignedIn` re-asserts an assignment ECM has just cleared and
    // keeps a synced service on the "planned here" side of the filter.
    expect(withAssignmentCleared(ASSIGNED).assignedIn).toBeUndefined();
  });

  it("keeps the plan stamp — dropping the driver is not unplanning", () => {
    expect(withAssignmentCleared(ASSIGNED).plannedIn).toBe("miot");
  });

  it("leaves everything else alone", () => {
    expect(withAssignmentCleared(ASSIGNED).cliente).toBe("ACME");
    expect(withAssignmentCleared(ASSIGNED).id).toBe("1658427-V");
  });
});
