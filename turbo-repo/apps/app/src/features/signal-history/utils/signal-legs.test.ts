import { describe, expect, it } from "vitest";
import { tripIdOfSignal, withDistances } from "./signal-legs";

describe("withDistances", () => {
  it("gives each position the metres from the previous one", () => {
    const legs = withDistances([
      { longitude: -70, latitude: -33 },
      { longitude: -70, latitude: -33.009 },
      { longitude: -70, latitude: -33.009 },
      { longitude: -70, latitude: -33.018 },
    ]);

    expect(legs.map((p) => p.distance)).toEqual([0, 1001, 0, 1001]);
    const total = legs.reduce((sum, p) => sum + p.distance, 0) / 1000;
    expect(total).toBeCloseTo(2.0, 1);
  });

  it("skips a position without coordinates", () => {
    const legs = withDistances([
      { longitude: -70, latitude: -33 },
      { longitude: Number.NaN, latitude: Number.NaN },
      { longitude: -70, latitude: -33.009 },
    ]);

    expect(legs.map((p) => p.distance)).toEqual([0, 0, 1001]);
  });

  it("keeps the other fields", () => {
    const [first] = withDistances([
      { longitude: -70, latitude: -33, assetid: "AB12", tripid: "T1" },
    ]);
    expect(first).toEqual({
      longitude: -70,
      latitude: -33,
      assetid: "AB12",
      tripid: "T1",
      distance: 0,
    });
  });
});

describe("tripIdOfSignal", () => {
  it("is null for a signal without a trip", () => {
    expect(tripIdOfSignal(undefined)).toBeNull();
    expect(tripIdOfSignal(null)).toBeNull();
    expect(tripIdOfSignal("null")).toBeNull();
    expect(tripIdOfSignal(" ")).toBeNull();
  });

  it("is the trip id otherwise", () => {
    expect(tripIdOfSignal("T1")).toBe("T1");
    expect(tripIdOfSignal(42)).toBe("42");
  });
});
