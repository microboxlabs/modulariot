import { describe, it, expect } from "vitest";
import { haversineKm } from "./distance";

describe("haversineKm", () => {
  it("is ~0 for the same point", () => {
    expect(haversineKm([-70.4, -23.65], [-70.4, -23.65])).toBeCloseTo(0, 5);
  });

  it("matches a known distance (Santiago → Antofagasta ≈ 1090 km)", () => {
    const d = haversineKm([-70.6693, -33.4489], [-70.4, -23.65]);
    expect(d).toBeGreaterThan(1050);
    expect(d).toBeLessThan(1130);
  });

  it("is symmetric", () => {
    const a: [number, number] = [-70.6, -33.4];
    const b: [number, number] = [-71.6, -33.0];
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
  });
});
