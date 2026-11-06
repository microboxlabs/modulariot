import { afterEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { PulseType } from "../components/tooltips/pulse-tooltip";
import type { MapPositionProperties } from "../types/map";
import { pinWithSignal, pulseWithSignal } from "./signal-tooltip";

const AT = "2026-01-01T00:00:00Z";
const offline = {
  state: "offline" as const,
  last_frame_at: AT,
  offline_since: AT,
};
const selected: PulseType = {
  properties: {
    asset_id: "V1",
    timestamp: AT,
    icu_code: 0,
    rotation: 0,
    latitude: 0,
    longitude: 0,
    speed: 0,
  },
};

afterEach(() => vi.useRealTimers());

describe("current popup signal", () => {
  it("updates an already selected pulse from online to offline and back", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse(AT) + 12 * 60_000);
    expect(pulseWithSignal(selected, "V1", offline, es)).toMatchObject({
      properties: { signal_label: "Sin señal · hace 12 min" },
    });
    vi.setSystemTime(Date.parse(AT) + 13 * 60_000);
    expect(pulseWithSignal(selected, "V1", offline, es)).toMatchObject({
      properties: { signal_label: "Sin señal · hace 13 min" },
    });
    expect(
      pulseWithSignal(selected, "V1", { state: "online" }, es)
    ).toMatchObject({ properties: { signal_label: null } });
    expect(pulseWithSignal(selected, "V2", offline, es)).toMatchObject({
      properties: { signal_label: null },
    });
    expect(
      pulseWithSignal(
        selected,
        "V1",
        { ...offline, last_frame_at: "2026-01-01T01:00:00Z" },
        es
      )
    ).toMatchObject({ properties: { signal_label: null } });
    expect(selected.properties.signal_label).toBeUndefined();
  });

  it("updates the summary from the current description while retaining its selection", () => {
    const captured = {
      elements: [0, 1],
      description: { signal_lag: "00:05:00" },
    };
    const current = {
      signal_lag: "00:06:00",
      last_reported_engine_status: false,
    };
    expect(pulseWithSignal(captured, "V1", offline, es, current)).toEqual({
      elements: [0, 1],
      description: current,
    });
    expect(captured.description.signal_lag).toBe("00:05:00");
  });

  it("looks up the selected live asset on each render, clearing removed and unknown states", () => {
    const captured = {
      properties: { asset_id: "V1", signal: offline },
    } as MapPositionProperties;
    expect(
      pinWithSignal(captured, [
        { assetid: "V1", timestamp: AT, signal: { state: "online" } },
      ])?.properties.signal?.state
    ).toBe("online");
    expect(
      pinWithSignal(captured, [
        { assetid: "V1", timestamp: AT, signal: { state: "unknown" } },
      ])?.properties.signal?.state
    ).toBe("unknown");
    expect(pinWithSignal(captured, [])?.properties.signal).toBeUndefined();
    expect(captured.properties.signal).toBe(offline);
  });

  it("hides an offline profile when a newer live-map position proves it is stale", () => {
    const captured = {
      properties: { asset_id: "V1", signal: offline },
    } as MapPositionProperties;
    expect(
      pinWithSignal(captured, [
        { assetid: "V1", timestamp: "2026-01-01T00:01:00Z", signal: offline },
      ])?.properties.signal
    ).toBeNull();
    expect(
      pinWithSignal(captured, [
        { assetid: "V1", timestamp: AT, signal: offline },
      ])?.properties.signal
    ).toBe(offline);
  });
});

describe("engine-off popup label", () => {
  const engine = { timestamp: AT, label: "Motor apagado" };

  it("labels the newest frame while the signal arrives", () => {
    expect(
      pulseWithSignal(
        selected,
        "V1",
        { state: "online" },
        es,
        undefined,
        engine
      )
    ).toMatchObject({
      properties: { signal_label: null, engine_label: "Motor apagado" },
    });
  });

  it("gives way to lost signal", () => {
    expect(
      pulseWithSignal(selected, "V1", offline, es, undefined, engine)
    ).toMatchObject({ properties: { engine_label: null } });
  });

  it("leaves other frames and assets without it", () => {
    const older = { timestamp: "2026-01-01T01:00:00Z", label: "Motor apagado" };
    expect(
      pulseWithSignal(selected, "V1", null, es, undefined, older)
    ).toMatchObject({ properties: { engine_label: null } });
    expect(
      pulseWithSignal(selected, "V2", null, es, undefined, engine)
    ).toMatchObject({ properties: { engine_label: null } });
  });

  it("reads the live asset's current engine state", () => {
    const captured = {
      properties: { asset_id: "V1", engine_off: false },
    } as MapPositionProperties;
    expect(
      pinWithSignal(captured, [
        { assetid: "V1", timestamp: AT, signal: null, engine_off: true },
      ])?.properties.engine_off
    ).toBe(true);
    expect(pinWithSignal(captured, [])?.properties.engine_off).toBe(false);
  });
});
