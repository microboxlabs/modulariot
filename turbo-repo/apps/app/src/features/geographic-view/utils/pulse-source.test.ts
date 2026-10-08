import { describe, expect, it } from "vitest";
import {
  countPulseSources,
  getMobilePulseRingHex,
  getSignalDescription,
  isDarkMapStyle,
  isMobilePulse,
  isVisiblePulse,
  mapCsvPulseRecord,
  normalizeCsvColumnName,
} from "./pulse-source";

describe("pulse source", () => {
  it.each(["app_gps", "APP_GPS", "app gps", "app-gps", "mobile", "mobile_app"])(
    "treats %s as a mobile pulse",
    (description) => {
      expect(isMobilePulse({ signal_description: description })).toBe(true);
    }
  );

  it.each(["gps", "truck", "GPS", "", undefined, null])(
    "treats %s as a GPS pulse",
    (description) => {
      expect(isMobilePulse({ signal_description: description })).toBe(false);
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

  it("maps CSV rows onto signal_description and drops mobile_origin", () => {
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
    });
    expect(
      mapCsvPulseRecord({ signal_description: "gps" }, 1, 2).signal_description
    ).toBe("gps");
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
    });
  });

  it("hides mobile pulses when the toggle is off", () => {
    expect(isVisiblePulse({ signal_description: "app_gps" }, false)).toBe(
      false
    );
    expect(isVisiblePulse({ signal_description: "gps" }, false)).toBe(true);
    expect(isVisiblePulse({ signal_description: "app_gps" }, true)).toBe(true);
  });

  it("counts mobile and GPS pulses", () => {
    expect(
      countPulseSources([
        { signal_description: "app_gps" },
        { signal_description: "APP_GPS" },
        { signal_description: "truck" },
        {},
      ])
    ).toEqual({ mobile: 2, gps: 2 });
  });

  it("picks a brighter yellow on dark maps and a deeper yellow on light maps", () => {
    expect(isDarkMapStyle("satellite")).toBe(true);
    expect(isDarkMapStyle("dark")).toBe(true);
    expect(isDarkMapStyle("hybrid")).toBe(true);
    expect(isDarkMapStyle("streets")).toBe(false);
    expect(isDarkMapStyle("outdoors")).toBe(false);
    expect(isDarkMapStyle("light")).toBe(false);
    expect(getMobilePulseRingHex(true)).toBe("#FFCE00");
    expect(getMobilePulseRingHex(false)).toBe("#D18900");
  });
});
