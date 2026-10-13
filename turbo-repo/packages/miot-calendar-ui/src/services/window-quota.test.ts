import { describe, it, expect } from "vitest";
import { indexWindowUsage, remainingWindowQuota } from "./window-quota";

const morning = { id: "tw-morning", quota: 15 };

describe("remainingWindowQuota", () => {
  const index = indexWindowUsage([
    {
      timeWindowId: "tw-morning",
      date: "2026-10-13",
      capacity: 15,
      booked: 0,
      available: 15,
    },
    {
      timeWindowId: "tw-morning",
      date: "2026-10-14",
      capacity: 15,
      booked: 15,
      available: 0,
    },
  ]);

  it("reads the calendar's remaining capacity for the window and date", () => {
    expect(remainingWindowQuota(index, morning, "2026-10-13", false)).toBe(15);
    expect(remainingWindowQuota(index, morning, "2026-10-14", false)).toBe(0);
  });

  it("treats a window-date without usage as having nothing booked", () => {
    expect(remainingWindowQuota(index, morning, "2026-10-15", false)).toBe(15);
  });

  it("gives back the place of a booking moving inside its own window", () => {
    expect(remainingWindowQuota(index, morning, "2026-10-14", true)).toBe(1);
  });
});
