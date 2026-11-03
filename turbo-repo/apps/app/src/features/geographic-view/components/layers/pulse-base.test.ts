import { describe, expect, it } from "vitest";
import {
  getColor,
  isOfflineFeature,
  pulseColor,
  stoppedMarkProps,
} from "./pulse-base";
import { OFFLINE_GRAY } from "../../utils/signal-state";

describe("stoppedMarkProps", () => {
  it("draws a stopped vehicle hollow, ringed in its level color, never red", () => {
    const props = stoppedMarkProps((d: { level: number }) => d.level);
    expect(props.getFillColor({ level: 0 })).toEqual([255, 255, 255, 255]);
    expect(props.getLineColor({ level: 0 })).toEqual(getColor(0));
    expect(props.getLineColor({ level: 3 })).toEqual(getColor(3));
    expect(props.stroked).toBe(true);
  });

  it("fills a stopped and offline vehicle gray, keeping its level ring", () => {
    const props = stoppedMarkProps(
      (d: { level: number; offline: boolean }) => d.level,
      (d) => d.offline
    );
    expect(props.getFillColor({ level: 2, offline: true })).toEqual(
      OFFLINE_GRAY
    );
    expect(props.getLineColor({ level: 2, offline: true })).toEqual(
      getColor(2)
    );
    expect(props.getFillColor({ level: 2, offline: false })).toEqual([
      255, 255, 255, 255,
    ]);
  });
});

describe("pulseColor", () => {
  it("keeps the level color while the signal arrives or is unknown", () => {
    expect(pulseColor({ properties: { icu_code: 3 } })).toEqual(getColor(3));
    expect(pulseColor({ properties: { icu_code: 0, offline: false } })).toEqual(
      getColor(0)
    );
  });

  it("draws an offline vehicle gray, whatever its level", () => {
    expect(pulseColor({ properties: { icu_code: 3, offline: true } })).toEqual(
      OFFLINE_GRAY
    );
    expect(isOfflineFeature({ properties: { offline: true } })).toBe(true);
    expect(isOfflineFeature({ properties: {} })).toBe(false);
  });
});
