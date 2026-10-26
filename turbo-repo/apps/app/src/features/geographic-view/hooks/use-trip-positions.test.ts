import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { positionsUrl, useTripPositions } from "./use-trip-positions";

class FakeEventSource {
  static readonly opened: FakeEventSource[] = [];
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  constructor(readonly url: string) {
    FakeEventSource.opened.push(this);
  }
}

describe("positionsUrl", () => {
  it("reads a trip's positions by trip and asset", () => {
    expect(positionsUrl("T 1", "AB12", "7")).toBe(
      "/app/api/map/trip?tripId=T%201&assetId=AB12"
    );
  });

  it("reads one of the evaluator's cases by its symptom, with a trip or not", () => {
    expect(positionsUrl("null", "DEMO008", "-9")).toBe(
      "/app/api/map/trip?symptomId=-9"
    );
    expect(positionsUrl("", "DEMO008", "-9")).toBe(
      "/app/api/map/trip?symptomId=-9"
    );
    expect(
      positionsUrl("5c1f0a52-3a8e-4bb1-9c55-0d7d1e0e6a01", "DEMO008", "-9")
    ).toBe("/app/api/map/trip?symptomId=-9");
  });

  it("reads nothing for a GPS database symptom without a trip", () => {
    expect(positionsUrl("null", "AB12", "7")).toBeNull();
    expect(positionsUrl("T1", "", "7")).toBeNull();
  });
});

describe("useTripPositions", () => {
  beforeEach(() => {
    FakeEventSource.opened.length = 0;
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens no stream for the string null as a trip", () => {
    const { result } = renderHook(() => useTripPositions("null", "AB12", "7"));
    expect(FakeEventSource.opened).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.positions).toEqual([]);
  });

  it("streams the vehicle's positions around a case without a trip", () => {
    const { result } = renderHook(() =>
      useTripPositions("null", "DEMO008", "-9")
    );
    const source = FakeEventSource.opened[0];
    expect(source.url).toBe("/app/api/map/trip?symptomId=-9");

    act(() => {
      source.onmessage?.({
        data: JSON.stringify({
          assetid: "DEMO008",
          latitude: -33,
          longitude: -70,
        }),
      });
      source.onerror?.();
    });

    expect(result.current.positions).toHaveLength(1);
    expect(result.current.isLoading).toBe(false);
    expect(source.close).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("logs only a stream that ended without positions", () => {
    renderHook(() => useTripPositions("T1", "AB12", "7"));
    const source = FakeEventSource.opened[0];
    expect(source.url).toBe("/app/api/map/trip?tripId=T1&assetId=AB12");

    act(() => source.onerror?.());

    expect(source.close).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
