import { describe, it, expect } from "vitest";
import {
  ringCentroid,
  estimateEtaHours,
  formatEtaHours,
} from "./vehicle-origin";

describe("ringCentroid", () => {
  it("averages the ring coordinates", () => {
    const ring: [number, number][] = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    expect(ringCentroid(ring)).toEqual([1, 1]);
  });

  it("returns null for an empty ring", () => {
    expect(ringCentroid([])).toBeNull();
  });
});

describe("estimateEtaHours", () => {
  it("divides distance by speed", () => {
    expect(estimateEtaHours(120, 60)).toBeCloseTo(2, 9);
  });

  it("returns null when stopped or speed unknown", () => {
    expect(estimateEtaHours(120, 0)).toBeNull();
    expect(estimateEtaHours(120, null)).toBeNull();
    expect(estimateEtaHours(120, undefined)).toBeNull();
  });
});

describe("formatEtaHours", () => {
  it("formats hours and minutes", () => {
    expect(formatEtaHours(2.5)).toBe("2h 30m");
  });

  it("drops the hours part under an hour", () => {
    expect(formatEtaHours(0.25)).toBe("15m");
  });
});
