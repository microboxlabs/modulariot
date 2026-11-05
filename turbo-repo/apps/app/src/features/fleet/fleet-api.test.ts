import { describe, expect, it } from "vitest";
import { ago, assetPath, assetsUrl, changedValues, hours } from "./fleet-api";

describe("assetsUrl", () => {
  it("sends only the filters that are set", () => {
    expect(assetsUrl({})).toBe("/app/api/fleet/assets");
    expect(
      assetsUrl({
        q: "ab 12",
        kind: "TRUCK",
        suggestions: false,
        documentsDue: true,
        carrier: "",
        page: 0,
      })
    ).toBe("/app/api/fleet/assets?q=ab+12&kind=TRUCK&documentsDue=true&page=0");
  });
});

describe("assetPath", () => {
  it("encodes ids that hold separators", () => {
    expect(assetPath("00:1A:2B")).toBe("/app/api/fleet/assets/00%3A1A%3A2B");
  });
});

describe("changedValues", () => {
  it("keeps edits, turns blanks into clears and skips untouched fields", () => {
    expect(
      changedValues(
        { label: "", carrier: "Andes", vin: "X1" },
        { label: " Tracto 1 ", carrier: "", vin: "X1" }
      )
    ).toEqual({ label: "Tracto 1", carrier: null });
  });
});

describe("hours and ago", () => {
  it("rounds seconds to tenths of an hour", () => {
    expect(hours(5400)).toBe(1.5);
    expect(hours(0)).toBe(0);
  });

  it("says how long ago, and a dash without a value", () => {
    const now = Date.parse("2026-10-14T12:00:00Z");
    expect(ago(null, "en", now)).toBe("—");
    expect(ago("2026-10-14T11:57:00Z", "en", now)).toBe("3 minutes ago");
    expect(ago("2026-10-13T12:00:00Z", "en", now)).toBe("yesterday");
  });
});
