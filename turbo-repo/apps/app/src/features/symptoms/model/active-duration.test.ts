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

  it("reads signs, fractions, any whitespace and parts in any order", () => {
    expect(activeSeconds("-1 days -02:00:00")).toBe(-86400 - 7200);
    expect(activeSeconds("1 year 2 mons 3 days")).toBe(
      365 * 86400 + 60 * 86400 + 3 * 86400
    );
    expect(activeSeconds("1\tday\n 1 day")).toBe(2 * 86400);
    expect(activeSeconds("01:00:00 1 day")).toBe(86400 + 3600);
    expect(activeSeconds("-00:00:01.5")).toBe(-1.5);
    expect(activeSeconds("1 day03:04:05")).toBe(97445);
    expect(activeSeconds("01:1 day00:00")).toBe(86400);
  });

  it("refuses intervals with extra or broken parts", () => {
    expect(activeSeconds("-1 days +02:00:00")).toBeUndefined();
    expect(activeSeconds("1.5 days")).toBeUndefined();
    expect(activeSeconds("01:00:00 02:00:00")).toBeUndefined();
    expect(activeSeconds("1 day x")).toBeUndefined();
    expect(activeSeconds("1 hour")).toBeUndefined();
  });

  it("refuses long runs of digits quickly", () => {
    const digits = "1".repeat(10_000);
    const started = performance.now();
    for (const text of [`${digits} x`, `${digits}:`, `1 ${digits}x`]) {
      expect(activeSeconds(text)).toBeUndefined();
    }
    expect(performance.now() - started).toBeLessThan(100);
  });
});
