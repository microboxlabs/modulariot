import { describe, expect, it } from "vitest";
import { caseWindowOf, pulsesInWindow } from "./case-window";

const mapWindow = {
  track_from: "2026-01-01T20:00:00Z",
  track_to: "2026-01-02T08:00:00Z",
  on_trip: true,
  case_from: "2026-01-02T05:40:00Z",
  case_to: "2026-01-02T06:10:00Z",
};

describe("caseWindowOf", () => {
  it("reads the case's own time, not the trip's", () => {
    expect(caseWindowOf({ map_window: mapWindow })).toEqual({
      from: "2026-01-02T05:40:00Z",
      to: "2026-01-02T06:10:00Z",
    });
  });

  it("falls back to the timeline entry from a server without map_window", () => {
    expect(
      caseWindowOf({
        timeline: [
          { start: "2026-01-02T05:40:00Z", end: "2026-01-02T06:00:00Z" },
        ],
      })
    ).toEqual({ from: "2026-01-02T05:40:00Z", to: "2026-01-02T06:00:00Z" });
    expect(caseWindowOf({ timeline: [] })).toBeNull();
    expect(caseWindowOf(null)).toBeNull();
  });
});

describe("pulsesInWindow", () => {
  const positions = [
    { timestamp: "2026-01-01T20:05:00Z" },
    { timestamp: "2026-01-02T05:40:00Z" },
    { timestamp: "2026-01-02T05:55:00Z" },
    { timestamp: null },
    { timestamp: "2026-01-02T06:10:00Z" },
    { timestamp: "2026-01-02T07:00:00Z" },
  ];
  const window = { from: mapWindow.case_from, to: mapWindow.case_to };

  it("keeps the positions inside the window, both ends included", () => {
    expect(pulsesInWindow(positions, window)).toEqual([1, 2, 4]);
  });

  it("is empty without positions, a window or a readable window", () => {
    expect(pulsesInWindow([], window)).toEqual([]);
    expect(pulsesInWindow(positions, null)).toEqual([]);
    expect(pulsesInWindow(positions, { from: "x", to: "y" })).toEqual([]);
  });
});
