import { describe, expect, it } from "vitest";
import { tripPlateNow } from "./plate-change";

describe("tripPlateNow", () => {
  it("returns the trip's plate after a truck change", () => {
    expect(tripPlateNow("TRUCK1", "TRUCK2")).toBe("TRUCK2");
  });

  it("returns null when the trip is still on the case's truck", () => {
    expect(tripPlateNow("TRUCK2", "truck2 ")).toBeNull();
  });

  it("returns null without both plates", () => {
    expect(tripPlateNow("TRUCK1", null)).toBeNull();
    expect(tripPlateNow(undefined, "TRUCK2")).toBeNull();
  });
});
