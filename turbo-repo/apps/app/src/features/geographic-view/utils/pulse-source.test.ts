import { describe, expect, it } from "vitest";
import {
  countPulseSources,
  filterVisiblePulses,
  getAppSignalRingHex,
  getSignalDescription,
  getSignalDetail,
  isDarkMapStyle,
  isVisiblePulse,
} from "./pulse-source";

describe("pulse source", () => {
  it("reads signal_description from the record or its properties", () => {
    expect(getSignalDescription({ signal_description: " app_gps " })).toBe(
      "app_gps"
    );
    expect(
      getSignalDescription({
        properties: { signal_description: "truck" },
      })
    ).toBe("truck");
  });

  it("hides app pulses when the toggle is off", () => {
    expect(isVisiblePulse({ signal_detail: "app" }, false)).toBe(false);
    expect(isVisiblePulse({ signal_detail: "gps" }, false)).toBe(true);
    expect(isVisiblePulse({ signal_detail: "unknown" }, false)).toBe(true);
    expect(isVisiblePulse({ signal_detail: "app" }, true)).toBe(true);
  });

  it("filters visible pulses without re-reading signal_description", () => {
    const pulses = [
      { signal_description: "truck", signal_detail: "gps" as const },
      { signal_description: "app_gps", signal_detail: "app" as const },
      { signal_description: null, signal_detail: "unknown" as const },
    ];
    expect(
      filterVisiblePulses(pulses, false).map((pulse) => pulse.signal_detail)
    ).toEqual(["gps", "unknown"]);
    expect(filterVisiblePulses(pulses, true)).toHaveLength(3);
  });

  it("reads stored signal_detail instead of reclassifying the description", () => {
    expect(
      getSignalDetail({
        signal_description: "app_gps",
        signal_detail: "gps",
      })
    ).toBe("gps");
  });

  it("counts app, gps, and unknown pulses", () => {
    expect(
      countPulseSources([
        { signal_detail: "app" },
        { signal_detail: "app" },
        { signal_detail: "gps" },
        { signal_detail: "unknown" },
        {},
      ])
    ).toEqual({ app: 2, gps: 1, unknown: 2 });
  });

  it("picks a brighter yellow on dark maps and a deeper yellow on light maps", () => {
    expect(isDarkMapStyle("satellite")).toBe(true);
    expect(isDarkMapStyle("dark")).toBe(true);
    expect(isDarkMapStyle("hybrid")).toBe(true);
    expect(isDarkMapStyle("streets")).toBe(false);
    expect(isDarkMapStyle("outdoors")).toBe(false);
    expect(isDarkMapStyle("light")).toBe(false);
    expect(getAppSignalRingHex(true)).toBe("#FFCE00");
    expect(getAppSignalRingHex(false)).toBe("#D18900");
  });
});
