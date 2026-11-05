import { describe, expect, it } from "vitest";
import {
  formatUsd,
  monthLabel,
  quotaLevel,
  quotaPercent,
  shiftMonth,
} from "./usage-view";

describe("metered usage view", () => {
  it("distinguishes an unknown charge from a known zero charge", () => {
    expect(formatUsd(null, "en")).toBe("—");
    expect(formatUsd(0, "en")).toBe("$0.00");
  });

  it("moves across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("names the month in UTC", () => {
    expect(monthLabel("2026-10", "en")).toBe("October 2026");
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
});
