import { describe, expect, it } from "vitest";
import {
  classifySignalDescription,
  countPulseSources,
  filterVisiblePulses,
  getAppSignalRingHex,
  getSignalDescription,
  getSignalDetail,
  hasAppSignalDetail,
  isDarkMapStyle,
  isVisiblePulse,
  mapCsvPulseRecord,
  normalizeCsvColumnName,
} from "./pulse-source";

describe("pulse source", () => {
  it.each(["app_gps", "APP_GPS", "app gps", "app-gps", "mobile", "mobile_app"])(
    "classifies %s as app signal_detail",
    (description) => {
      expect(classifySignalDescription(description)).toBe("app");
      expect(
        hasAppSignalDetail({
          signal_detail: classifySignalDescription(description),
        })
      ).toBe(true);
    }
  );

  it.each(["gps", "truck", "GPS"])(
    "classifies %s as gps signal_detail",
    (description) => {
      expect(classifySignalDescription(description)).toBe("gps");
    }
  );

  it.each(["", undefined, null])(
    "classifies missing %s as unknown, not gps",
    (description) => {
      expect(classifySignalDescription(description as string | null)).toBe(
        "unknown"
      );
    }
  );

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

  it("maps CSV rows onto signal_description, signal_detail, and drops mobile_origin", () => {
    expect(
      mapCsvPulseRecord(
        {
          location: "wkb",
          mobile_origin: true,
          type_signal_description: "app_gps",
        },
        -70.6,
        -33.4
      )
    ).toEqual({
      location: "wkb",
      longitude: -70.6,
      latitude: -33.4,
      signal_description: "app_gps",
      signal_detail: "app",
    });
    expect(
      mapCsvPulseRecord({ signal_description: "gps" }, 1, 2)
    ).toMatchObject({
      signal_description: "gps",
      signal_detail: "gps",
    });
    expect(mapCsvPulseRecord({}, 1, 2).signal_detail).toBe("unknown");
  });

  it("normalizes CSV headers before records are mapped", () => {
    expect(normalizeCsvColumnName("\uFEFF Signal_Description ")).toBe(
      "signal_description"
    );
  });

  it("reads camelCase and spaced CSV aliases as signal_description", () => {
    expect(
      mapCsvPulseRecord({ signalDescription: "truck" }, 1, 2)
        .signal_description
    ).toBe("truck");
    expect(
      mapCsvPulseRecord({ " Type_Signal_Description ": "app_gps" }, 1, 2)
        .signal_description
    ).toBe("app_gps");
    expect(
      mapCsvPulseRecord(
        { signalDescription: "truck", typeSignalDescription: "app_gps" },
        1,
        2
      )
    ).toEqual({
      longitude: 1,
      latitude: 2,
      signal_description: "truck",
      signal_detail: "gps",
    });
  });

  it("hides app pulses when the toggle is off", () => {
    expect(
      isVisiblePulse({ signal_detail: "app" }, false)
    ).toBe(false);
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
