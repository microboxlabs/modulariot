import { describe, expect, it } from "vitest";
import { activeSeconds, formatActiveDuration } from "./active-duration";

describe("active duration", () => {
  it("formats the evaluator's seconds", () => {
    expect(formatActiveDuration(30813)).toBe("8 h 33 min");
    expect(formatActiveDuration(31163)).toBe("8 h 39 min");
    expect(formatActiveDuration(45)).toBe("45 s");
    expect(formatActiveDuration(600)).toBe("10 min");
    expect(formatActiveDuration(7200)).toBe("2 h");
    expect(formatActiveDuration(2 * 86400 + 4 * 3600 + 59)).toBe("2 d 4 h");
  });

  it("formats the GPS database's intervals the same way", () => {
    expect(formatActiveDuration("08:33:33")).toBe("8 h 33 min");
    expect(formatActiveDuration("00:00:12.345")).toBe("12 s");
    expect(formatActiveDuration("1 day 02:03:04")).toBe("1 d 2 h");
    expect(formatActiveDuration("3 days")).toBe("3 d");
    expect(activeSeconds("1 mon 2 days 00:00:01")).toBe(32 * 86400 + 1);
    expect(activeSeconds("30813")).toBe(30813);
  });

  it("leaves what it cannot read as it came", () => {
    expect(formatActiveDuration("soon")).toBe("soon");
    expect(formatActiveDuration(null)).toBeUndefined();
    expect(formatActiveDuration(-5)).toBe("0 s");
  });
});
