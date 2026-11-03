import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTreatmentsLocation } from "./client-api.provider";

const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("./fetcher", () => ({ default: read, createFetcherError: vi.fn() }));

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
describe("engine case popup refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    read.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("refreshes live indicators every minute, stops at closure, and keeps historical lag", async () => {
    const open = {
      type: "FeatureCollection",
      features: [],
      closed: false,
      description: { signal_lag: "00:05:00" },
    };
    read
      .mockResolvedValueOnce(open)
      .mockResolvedValueOnce({
        ...open,
        description: { signal_lag: "00:06:00" },
      })
      .mockResolvedValue({
        ...open,
        closed: true,
        description: { signal_lag: "00:06:20" },
      });
    const { result, unmount } = renderHook(
      () => useTreatmentsLocation("", "Demo", "-1"),
      { wrapper }
    );
    await advance();
    expect(result.current.data?.description.signal_lag).toBe("00:05:00");
    await advance(60_000);
    expect(result.current.data?.description.signal_lag).toBe("00:06:00");
    await advance(60_000);
    expect(result.current.data?.closed).toBe(true);
    await advance(5 * 60_000);
    expect(read).toHaveBeenCalledTimes(3);
    expect(result.current.data?.description.signal_lag).toBe("00:06:20");
    unmount();
  });

  it("stops live description polling when its map unmounts", async () => {
    read.mockResolvedValue({ closed: false, description: {} });
    const { unmount } = renderHook(
      () => useTreatmentsLocation("", "Demo", "-1"),
      { wrapper }
    );
    await advance();
    unmount();
    await advance(5 * 60_000);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
