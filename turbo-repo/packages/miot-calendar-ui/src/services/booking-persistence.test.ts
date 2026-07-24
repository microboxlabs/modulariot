import { describe, expect, it } from "vitest";
import { preEditSnapshot } from "./booking-persistence";
import type { PlannedService } from "../types/planning";

type Item = { id: string; label?: string };

function planned(
  id: string,
  hour: number,
  label?: string
): PlannedService<Item> {
  return {
    service: { id, ...(label ? { label } : {}) },
    slot: { date: new Date("2026-07-23"), hour, minutes: 0 },
  };
}

describe("preEditSnapshot", () => {
  it("keeps the reassignment snapshot, which alone carries the pre-move slot", () => {
    const current = planned("s1", 14);
    const beforeMove = planned("s1", 9);
    expect(preEditSnapshot([current], "s1", beforeMove)).toBe(beforeMove);
  });

  it("restores the current entry when an assignment fails", () => {
    // The item is already planned and the confirm only changed its resources;
    // a refused assign must leave the chip exactly where it was.
    const current = planned("s1", 14, "driver-a");
    const grid = [current, planned("s2", 15)];
    expect(preEditSnapshot(grid, "s1", null)).toBe(current);
  });

  it("returns null for a first-time plan", () => {
    // Nothing to restore — dropping the optimistic entry is the whole rollback.
    expect(preEditSnapshot([planned("s2", 15)], "s1", null)).toBeNull();
    expect(preEditSnapshot([], "s1", null)).toBeNull();
  });
});
