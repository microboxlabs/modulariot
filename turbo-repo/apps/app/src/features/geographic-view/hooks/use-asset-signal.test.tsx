import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SIGNAL_REFRESH_MS, useAssetSignal } from "./use-asset-signal";

const FIRST = "2026-01-01T00:00:00Z";
const NEWEST = "2026-01-01T00:10:00Z";
const fetchSignal = vi.fn();

function wrapper({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        refreshWhenHidden: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}

async function advance(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useAssetSignal polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchSignal.mockReset();
    fetchSignal.mockImplementation(async () =>
      Response.json({ state: "offline", last_frame_at: NEWEST })
    );
    vi.stubGlobal("fetch", fetchSignal);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("refreshes a current track every minute and stops when unmounted", async () => {
    const { result, unmount } = renderHook(() => useAssetSignal("V1", NEWEST), {
      wrapper,
    });
    await advance();
    expect(result.current?.state).toBe("offline");
    expect(fetchSignal).toHaveBeenCalledTimes(1);
    await advance(SIGNAL_REFRESH_MS - 1);
    expect(fetchSignal).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchSignal).toHaveBeenCalledTimes(2);
    unmount();
    await advance(5 * SIGNAL_REFRESH_MS);
    expect(fetchSignal).toHaveBeenCalledTimes(2);
  });

  it("stops refreshing a historical track and resumes when its newest frame changes", async () => {
    const { rerender, unmount } = renderHook(
      ({ timestamp }) => useAssetSignal("V1", timestamp),
      {
        wrapper,
        initialProps: { timestamp: FIRST },
      }
    );
    await advance();
    await advance(5 * SIGNAL_REFRESH_MS);
    expect(fetchSignal).toHaveBeenCalledTimes(1);
    rerender({ timestamp: NEWEST });
    await advance();
    expect(fetchSignal).toHaveBeenCalledTimes(2);
    await advance(SIGNAL_REFRESH_MS);
    expect(fetchSignal).toHaveBeenCalledTimes(3);
    unmount();
  });

  it("does not fetch without an asset", async () => {
    const { unmount } = renderHook(() => useAssetSignal(null, NEWEST), {
      wrapper,
    });
    await advance(5 * SIGNAL_REFRESH_MS);
    expect(fetchSignal).not.toHaveBeenCalled();
    unmount();
  });

  it("keeps polling while the detector is behind the track and catches up", async () => {
    fetchSignal.mockImplementationOnce(async () =>
      Response.json({ state: "offline", last_frame_at: FIRST })
    );
    const { result, unmount } = renderHook(() => useAssetSignal("V1", NEWEST), {
      wrapper,
    });
    await advance();
    expect(result.current?.last_frame_at).toBe(FIRST);
    await advance(SIGNAL_REFRESH_MS);
    expect(fetchSignal).toHaveBeenCalledTimes(2);
    expect(result.current?.last_frame_at).toBe(NEWEST);
    await advance(SIGNAL_REFRESH_MS);
    expect(fetchSignal).toHaveBeenCalledTimes(3);
    unmount();
  });

  it("treats an invalid response as unknown", async () => {
    fetchSignal.mockImplementation(async () =>
      Response.json({ state: "offline", silence_s: "invalid" })
    );
    const { result, unmount } = renderHook(() => useAssetSignal("V1", NEWEST), {
      wrapper,
    });
    await advance();
    expect(result.current).toBeNull();
    unmount();
  });
});
