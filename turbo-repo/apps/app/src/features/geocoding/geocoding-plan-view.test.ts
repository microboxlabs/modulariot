import { describe, expect, it } from "vitest";
import {
  cacheHitRate,
  quotaLevel,
  quotaPercent,
  shiftMonth,
} from "./geocoding-plan-view";
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
  it("moves across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("warns from the alert share and stops at the quota", () => {
    expect(quotaLevel(799, 1000, 80)).toBe("ok");
    expect(quotaLevel(800, 1000, 80)).toBe("alert");
    expect(quotaLevel(1000, 1000, 80)).toBe("exhausted");
  });

  it("caps the bar at 100 and fills it for a zero quota with calls", () => {
    expect(quotaPercent(1500, 1000)).toBe(100);
    expect(quotaPercent(1, 0)).toBe(100);
    expect(quotaPercent(0, 0)).toBe(0);
  });

  it("has no cache hit rate without resolutions", () => {
    expect(cacheHitRate(usage(0, 0))).toBeNull();
    expect(cacheHitRate(usage(8, 2))).toBe(25);
  });
});
