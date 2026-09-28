import { describe, expect, it } from "vitest";
import { formatElapsed, splitNarration } from "./run-progress";

describe("splitNarration", () => {
  it("takes the last line as the step in progress", () => {
    expect(
      splitNarration("Connecting\n\nQuerying the data\nReading trips\n")
    ).toEqual({
      earlier: "Connecting\n\nQuerying the data",
      current: "Reading trips",
    });
  });

  it("handles a single line and empty narration", () => {
    expect(splitNarration("Connecting")).toEqual({
      earlier: "",
      current: "Connecting",
    });
    expect(splitNarration("  ")).toEqual({ earlier: "", current: null });
  });
});

describe("formatElapsed", () => {
  it("formats as mm:ss and h:mm:ss", () => {
    expect(formatElapsed(0)).toBe("00:00");
    expect(formatElapsed(65_400)).toBe("01:05");
    expect(formatElapsed(3_725_000)).toBe("1:02:05");
    expect(formatElapsed(-50)).toBe("00:00");
  });
});
