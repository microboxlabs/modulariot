import { describe, expect, it } from "vitest";
import {
  dashSegments,
  frameDelay,
  isLate,
  LATE_FRAME_S,
  silenceGap,
} from "./frame-delays";

const frame = (
  timestamp: string,
  longitude: number,
  extra: Record<string, unknown> = {}
) => ({ timestamp, longitude, latitude: 0, ...extra });

describe("frameDelay and isLate", () => {
  it("reads the delay the backend gives, else computes it", () => {
    expect(frameDelay(frame("2026-01-01T00:00:00Z", 0, { delay_s: 30 }))).toBe(
      30
    );
    expect(
      frameDelay(
        frame("2026-01-01T00:00:00Z", 0, {
          received_at: "2026-01-01T00:12:00Z",
        })
      )
    ).toBe(720);
    expect(frameDelay(frame("2026-01-01T00:00:00Z", 0))).toBeNull();
  });

  it("marks frames that arrived 10 min late or more", () => {
    expect(isLate(frame("t", 0, { delay_s: LATE_FRAME_S }))).toBe(true);
    expect(isLate(frame("t", 0, { delay_s: LATE_FRAME_S - 1 }))).toBe(false);
    expect(isLate(frame("t", 0))).toBe(false);
  });
});

describe("silenceGap", () => {
  const frames = [
    frame("2026-01-01T00:00:00Z", 1),
    frame("2026-01-01T00:05:00Z", 2),
    frame("2026-01-01T00:50:00Z", 3),
    frame("2026-01-01T00:55:00Z", 4),
  ];

  it("joins the last frame before the silence to the first after it", () => {
    expect(silenceGap(frames, "2026-01-01T00:05:00Z")).toEqual({
      from: [2, 0],
      to: [3, 0],
    });
  });

  it("is null while still silent or without a lost signal", () => {
    expect(silenceGap(frames, "2026-01-01T00:55:00Z")).toBeNull();
    expect(silenceGap(frames, null)).toBeNull();
    expect(silenceGap([], "2026-01-01T00:05:00Z")).toBeNull();
  });
});

describe("dashSegments", () => {
  it("cuts the line into dashes from end to end", () => {
    const dashes = dashSegments([0, 0], [3, 0], 2);
    expect(dashes).toEqual([
      { from: [0, 0], to: [1, 0] },
      { from: [2, 0], to: [3, 0] },
    ]);
  });
});

describe("formatDelay", () => {
  it("reads as seconds, minutes or hours", async () => {
    const { formatDelay } =
      await import("../components/tooltips/pulse-tooltip");
    expect(formatDelay(45)).toBe("45 s");
    expect(formatDelay(720)).toBe("12 min");
    expect(formatDelay(7500)).toBe("2 h 5 min");
    expect(formatDelay(7200)).toBe("2 h");
  });
});
