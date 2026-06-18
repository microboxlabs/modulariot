import { describe, it, expect } from "vitest";
import {
  haversineKm,
  ringCentroid,
  estimateEtaHours,
  formatEtaHours,
} from "./vehicle-origin";

describe("haversineKm", () => {
  it("is ~0 for the same point", () => {
    expect(haversineKm([-70.66, -33.44], [-70.66, -33.44])).toBeCloseTo(0, 5);
  });

  it("matches a known distance (Santiago → Antofagasta ≈ 1090 km)", () => {
    // [lng, lat]
    const santiago: [number, number] = [-70.6693, -33.4489];
    const antofagasta: [number, number] = [-70.4, -23.65];
    expect(haversineKm(santiago, antofagasta)).toBeGreaterThan(1050);
    expect(haversineKm(santiago, antofagasta)).toBeLessThan(1130);
  });

  it("is symmetric", () => {
    const a: [number, number] = [-70.6, -33.4];
    const b: [number, number] = [-71.6, -33.0];
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
  });
});

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
