import { describe, expect, it } from "vitest";
import {
  formatLeft,
  offeredDuration,
  secondsLeft,
  towerScope,
  UNTIL_TRIP_END,
} from "./ignore-hold";

describe("ignore hold", () => {
  it("maps the form's scopes to the API's", () => {
    expect(towerScope("synthom")).toBe("CASE");
    expect(towerScope("same_synthoms")).toBe("SYMPTOM");
    expect(towerScope("all_synthoms")).toBe("ALL");
    expect(towerScope("")).toBe("CASE");
    expect(towerScope(undefined)).toBe("CASE");
  });

  it("keeps an offered duration and falls back to five minutes", () => {
    expect(offeredDuration(1800, false)).toBe(1800);
    expect(offeredDuration(0, false)).toBe(300);
    expect(offeredDuration(UNTIL_TRIP_END, true)).toBe(UNTIL_TRIP_END);
    expect(offeredDuration(UNTIL_TRIP_END, false)).toBe(300);
  });

  it("counts the time left", () => {
    const now = Date.parse("2026-11-03T12:00:00Z");
    expect(secondsLeft({ until: "2026-11-03T12:04:30Z" }, now)).toBe(270);
    expect(secondsLeft({ until: "2026-11-03T11:00:00Z" }, now)).toBe(0);
    expect(secondsLeft({ until: null }, now)).toBeNull();
  });

  it("formats the time left", () => {
    expect(formatLeft(20)).toBe("1 min");
    expect(formatLeft(270)).toBe("5 min");
    expect(formatLeft(3600)).toBe("1 h");
    expect(formatLeft(3900)).toBe("1 h 05 min");
  });
});
