import { describe, expect, it } from "vitest";
import { pulseLevel, type PulseType } from "./pulse-tooltip";

const frame = (
  extra: Partial<PulseType["properties"]>
): PulseType["properties"] => ({
  icu_code: 0,
  asset_id: "A1",
  rotation: 0,
  latitude: 0,
  longitude: 0,
  speed: 0,
  timestamp: "2026-01-01T00:00:00Z",
  ...extra,
});

describe("pulseLevel", () => {
  it("shows the symptom's level for a blue frame inside a case", () => {
    expect(pulseLevel(frame({ icu_code: 0, symptom_level: 2 }))).toBe("2");
  });

  it("falls back to the dot's own code when the frame is in no case", () => {
    expect(pulseLevel(frame({ icu_code: 3 }))).toBe("3");
    expect(pulseLevel(frame({ symptom_level: null }))).toBe("0");
    expect(pulseLevel(frame({ symptom_level: null, icu_code: 3 }))).toBe("3");
  });
});
