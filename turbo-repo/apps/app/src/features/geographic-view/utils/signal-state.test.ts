import { describe, expect, it } from "vitest";
import {
  isNewestFrame,
  isOfflineFrame,
  isOffline,
  offlineAge,
  offlineLabel,
} from "./signal-state";
import es from "@/lang/es.json";
import en from "@/lang/en.json";

const NOW = Date.parse("2026-11-03T12:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

describe("isNewestFrame", () => {
  it("does not gray a fresh live position when the detector's profile is stale", () => {
    const signal = {
      state: "offline" as const,
      last_frame_at: "2026-01-01T00:00:00Z",
    };
    expect(isOfflineFrame("2026-01-01T00:00:00Z", signal)).toBe(true);
    expect(isOfflineFrame("2026-01-01T00:01:00Z", signal)).toBe(false);
    expect(
      isOfflineFrame("2026-01-01T00:00:00Z", { ...signal, state: "online" })
    ).toBe(false);
  });
  it("matches the detector frame across timestamp formats, never an older or newer frame", () => {
    const signal = {
      state: "offline" as const,
      last_frame_at: "2026-01-01T00:00:00Z",
    };
    expect(isNewestFrame("2025-12-31T21:00:00-03:00", signal)).toBe(true);
    expect(isNewestFrame("2025-12-31T23:59:59.500Z", signal)).toBe(false);
    expect(isNewestFrame("2026-01-01T00:00:01Z", signal)).toBe(false);
    expect(isNewestFrame("invalid", signal)).toBe(false);
  });
});

describe("offlineAge", () => {
  it("counts minutes up to 90, then hours", () => {
    expect(offlineAge(ago(12), NOW)).toEqual({ n: 12, unit: "min" });
    expect(offlineAge(ago(90), NOW)).toEqual({ n: 90, unit: "min" });
    expect(offlineAge(ago(91), NOW)).toEqual({ n: 2, unit: "h" });
    expect(offlineAge(ago(150), NOW)).toEqual({ n: 3, unit: "h" });
  });

  it("is at least one minute, and nothing for a bad date", () => {
    expect(offlineAge(ago(0), NOW)).toEqual({ n: 1, unit: "min" });
    expect(offlineAge("not a date", NOW)).toBeNull();
  });
});

describe("offlineLabel", () => {
  it("says how long ago the signal stopped, in Spanish and English", () => {
    const signal = { state: "offline" as const, offline_since: ago(12) };
    expect(offlineLabel(signal, es, NOW)).toBe("Sin señal · hace 12 min");
    expect(offlineLabel(signal, en, NOW)).toBe("No signal · 12 min ago");
    expect(
      offlineLabel({ state: "offline", offline_since: ago(120) }, es, NOW)
    ).toBe("Sin señal · hace 2 h");
    expect(
      offlineLabel({ state: "offline", offline_since: ago(120) }, en, NOW)
    ).toBe("No signal · 2 h ago");
  });

  it("is only for an offline vehicle", () => {
    expect(offlineLabel({ state: "online" }, es, NOW)).toBeNull();
    expect(offlineLabel({ state: "unknown" }, es, NOW)).toBeNull();
    expect(offlineLabel(null, es, NOW)).toBeNull();
    expect(offlineLabel({ state: "offline" }, es, NOW)).toBe("Sin señal");
    expect(isOffline({ state: "offline" })).toBe(true);
    expect(isOffline({ state: "unknown" })).toBe(false);
  });
});
