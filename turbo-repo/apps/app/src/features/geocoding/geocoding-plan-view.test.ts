import { describe, expect, it } from "vitest";
import { cacheHitRate } from "./geocoding-plan-view";
import type { GeocodingUsage } from "./geocoding-plan.types";

const usage = (resolutions: number, cacheHits: number): GeocodingUsage => ({
  periodStart: "2026-10-01T00:00:00Z",
  periodEnd: "2026-11-01T00:00:00Z",
  quota: 1000,
  used: 0,
  resolutions,
  cacheHits,
  overageCalls: 0,
  overageUsd: null,
  chargeUsd: null,
  bySource: [],
});

describe("geocoding usage view", () => {
  it("has no cache hit rate without resolutions", () => {
    expect(cacheHitRate(usage(0, 0))).toBeNull();
    expect(cacheHitRate(usage(8, 2))).toBe(25);
  });
});
