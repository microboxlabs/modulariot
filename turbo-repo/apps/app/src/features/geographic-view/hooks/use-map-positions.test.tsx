import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMapPositions } from "@/features/common/providers/client-api.provider";
import type { MapPositionProperties } from "../types/map";
import { pinWithSignal } from "../utils/signal-tooltip";

const AT = "2026-11-03T11:48:00Z";
const signal = {
  state: "offline",
  last_frame_at: AT,
  offline_since: AT,
};

function wrapper({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      {children}
    </SWRConfig>
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("live position asset aliases", () => {
  it.each([
    { asset_id: "AB12" },
    { assetid: "AB12" },
    { asset_id: "AB12", assetid: "OLD" },
    { asset_id: " ", assetid: "AB12" },
  ])("keeps the offline pointer and popup for %j", async (asset) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json([
          {
            ...asset,
            timestamp: AT,
            location: "0101000020E610000000000000008051C000000000008040C0",
            signal,
          },
        ])
      )
    );
    const { result } = renderHook(() => useMapPositions(), { wrapper });
    await waitFor(() => expect(result.current.positions).toHaveLength(1));
    expect(result.current.positions[0]).toMatchObject({
      asset_id: "AB12",
      assetid: "AB12",
      lost_signal: true,
      signal,
    });
    const selected = {
      properties: { asset_id: "AB12", signal: { state: "online" } },
    } as MapPositionProperties;
    expect(
      pinWithSignal(selected, result.current.positions)?.properties.signal
    ).toEqual(signal);
  });
});

describe("live position engine state", () => {
  it.each([
    { engine: { sensors: { engine_status: false } }, off: true },
    { engine: { engine_status: "off" }, off: true },
    {
      engine: { sensors: { engine_status: true }, engine_status: "off" },
      off: false,
    },
    { engine: { engine_status: null }, off: false },
    { engine: {}, off: false },
  ])("maps $engine without declaring lost signal", async ({ engine, off }) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json([
          {
            asset_id: "AB12",
            timestamp: AT,
            location: "0101000020E610000000000000008051C000000000008040C0",
            ...engine,
          },
        ])
      )
    );
    const { result } = renderHook(() => useMapPositions(), { wrapper });
    await waitFor(() => expect(result.current.positions).toHaveLength(1));
    expect(result.current.positions[0]).toMatchObject({
      engine_off: off,
      lost_signal: false,
    });
  });
});
