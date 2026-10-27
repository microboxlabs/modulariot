import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { historicPulsesUrl, useHistoricPulse } from "./use-historic-pulse";

class FakeEventSource {
  static readonly opened: FakeEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  readonly listeners: Record<string, () => void> = {};
  addEventListener(type: string, listener: () => void) {
    this.listeners[type] = listener;
  }
  constructor(readonly url: string) {
    FakeEventSource.opened.push(this);
  }
}

const FROM = "2026-10-22T00:00:00+05:30";
const TO = "2026-10-23T23:59:59+05:30";

describe("historicPulsesUrl", () => {
  it("encodes the asset and the range, offsets included", () => {
    expect(historicPulsesUrl("AB 12", FROM, TO)).toBe(
      "/app/api/map/historic-pulses?assetId=AB+12&p_from=2026-10-22T00%3A00%3A00%2B05%3A30&p_to=2026-10-23T23%3A59%3A59%2B05%3A30"
    );
  });

  it("is null without the asset or the range", () => {
    expect(historicPulsesUrl("", FROM, TO)).toBeNull();
    expect(historicPulsesUrl("AB12", "", TO)).toBeNull();
  });
});

describe("useHistoricPulse", () => {
  beforeEach(() => {
    FakeEventSource.opened.length = 0;
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads the range given on mount, as from a link", () => {
    const { result } = renderHook(() => useHistoricPulse("AB12", FROM, TO));
    const source = FakeEventSource.opened[0];
    expect(FakeEventSource.opened).toHaveLength(1);
    expect(source.url).toBe(historicPulsesUrl("AB12", FROM, TO));
    expect(result.current.isLoading).toBe(true);

    act(() => {
      source.onopen?.();
      source.onmessage?.({ data: JSON.stringify({ assetid: "AB12" }) });
      source.onmessage?.({ data: JSON.stringify({ assetid: "AB12" }) });
      source.onerror?.();
    });

    expect(result.current.positions).toHaveLength(2);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(source.close).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("ends an empty stream with no positions and no error", () => {
    const { result } = renderHook(() => useHistoricPulse("AB12", FROM, TO));

    act(() => {
      FakeEventSource.opened[0].onopen?.();
      FakeEventSource.opened[0].onerror?.();
    });

    expect(result.current.positions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("reports a stream that never opened", () => {
    const { result } = renderHook(() => useHistoricPulse("AB12", FROM, TO));

    act(() => {
      FakeEventSource.opened[0].onerror?.();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).not.toBeNull();
  });

  it("reports a stream that sent failed before closing", () => {
    const { result } = renderHook(() => useHistoricPulse("AB12", FROM, TO));
    const source = FakeEventSource.opened[0];

    act(() => {
      source.onopen?.();
      source.listeners.failed?.();
      source.onerror?.();
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("opens no stream without the range", () => {
    const { result } = renderHook(() => useHistoricPulse("AB12", "", ""));

    expect(FakeEventSource.opened).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
  });
});
