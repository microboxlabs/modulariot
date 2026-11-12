import { describe, expect, it } from "vitest";
import {
  getColor,
  isLateFeature,
  isOfflineFeature,
  LATE_GRAY,
  pulseColor,
  stoppedCenterProps,
  stoppedDotProps,
} from "./pulse-base";
import { PulsePinLayer } from "./pulse";
import type { Layer } from "deck.gl";
import { OFFLINE_GRAY } from "../../utils/signal-state";

describe("stopped pulses", () => {
  it("draws a stopped vehicle as a level-color dot with a white center on top, never red", () => {
    const dot = stoppedDotProps((d: { level: number }) => d.level);
    const center = stoppedCenterProps();
    expect(dot.getFillColor({ level: 0 })).toEqual(getColor(0));
    expect(dot.getFillColor({ level: 3 })).toEqual(getColor(3));
    expect(center.getFillColor({})).toEqual([255, 255, 255, 255]);
    // the center leaves a 2px ring of the level color
    expect(dot.getRadius - center.getRadius).toBe(2);
    expect(center.pickable).toBe(false);
  });

  it("grays a stopped and offline vehicle's center, keeping its level ring", () => {
    const dot = stoppedDotProps((d: { level: number }) => d.level);
    const center = stoppedCenterProps((d: { offline: boolean }) => d.offline);
    expect(center.getFillColor({ offline: true })).toEqual(OFFLINE_GRAY);
    expect(center.getFillColor({ offline: false })).toEqual([
      255, 255, 255, 255,
    ]);
    expect(dot.getFillColor({ level: 2 })).toEqual(getColor(2));
  });

  it("draws every stopped center after every dot color", () => {
    const stopped = (id: number) => ({
      geometry: { type: "Point", coordinates: [-70.6 + id * 1e-5, -33.4] },
      properties: { id, speed: 0, icu_code: 0 },
    });
    const moving = {
      geometry: { type: "Point", coordinates: [-70.6, -33.4] },
      properties: { id: 3, speed: 40, icu_code: 0 },
    };
    const layer = new PulsePinLayer({
      id: "pulses",
      data: { features: [stopped(1), stopped(2), moving] },
      showStops: true,
      displayPosition: 10,
      selectedPulse: [2],
    });
    const ids = (layer.renderLayers() as Layer[]).map((l) => l.id);
    const at = (id: string) => ids.indexOf(id);
    expect(at("pulse-stopped-vehicles-center-layer")).toBeGreaterThan(
      at("pulse-stopped-vehicles-layer")
    );
    expect(at("pulse-stopped-vehicles-center-layer")).toBeGreaterThan(
      at("pulse-moving-vehicles-layer")
    );
    expect(at("pulse-selected-stopped-vehicles-center-layer")).toBeGreaterThan(
      at("pulse-selected-stopped-vehicles-layer")
    );
    expect(at("pulse-selected-stopped-vehicles-center-layer")).toBeGreaterThan(
      at("pulse-selected-vehicles-layer")
    );
  });
});

describe("late frames", () => {
  it("draws a late frame gray instead of its color, moving or stopped", () => {
    const late = { properties: { icu_code: 0, delay_s: 900 } };
    const onTime = { properties: { icu_code: 0, delay_s: 30 } };
    expect(isLateFeature(late)).toBe(true);
    expect(isLateFeature(onTime)).toBe(false);
    expect(isLateFeature({ properties: { delay_s: null } })).toBe(false);
    expect(pulseColor(late)).toEqual(LATE_GRAY);
    expect(pulseColor(onTime)).toEqual(getColor(0));
    const dot = stoppedDotProps(
      (d: { level: number; late: boolean }) => d.level,
      (d) => d.late
    );
    expect(dot.getFillColor({ level: 0, late: true })).toEqual(LATE_GRAY);
    expect(dot.getFillColor({ level: 0, late: false })).toEqual(getColor(0));
  });

  it("keeps an offline vehicle's gray over a late one's", () => {
    expect(
      pulseColor({ properties: { icu_code: 0, delay_s: 900, offline: true } })
    ).toEqual(OFFLINE_GRAY);
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
