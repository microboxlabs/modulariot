import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSymptomCounts } from "./client-api.provider";

const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("./fetcher", () => ({ default: read, createFetcherError: vi.fn() }));

function wrapper({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

const COUNTS = {
  conditions: {
    codeBlack: 1,
    critic: 0,
    compromised: 2,
    observation: 0,
    treatment: 0,
    stable: 0,
  },
  vehiclesOnTrip: 7,
  ignored: 0,
};

describe("useSymptomCounts", () => {
  beforeEach(() => {
    read.mockReset();
    read.mockResolvedValue(COUNTS);
  });

  it("reads the counts for the table's filters", async () => {
    const { result } = renderHook(
      () =>
        useSymptomCounts({
          asset_id: "AB12",
          symptom_name: "Pérdida de señal",
          date_range: { from: "2026-10-01", to: "2026-10-02" },
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.counts).toEqual(COUNTS));
    const url = new URL(read.mock.calls[0][0], "http://x");
    expect(url.pathname).toBe("/app/api/symptoms/counts");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      asset_id: "AB12",
      symptom_name: "Pérdida de señal",
      from: "2026-10-01",
      to: "2026-10-02",
    });
  });

  it("sends no filters when none is set", async () => {
    renderHook(() => useSymptomCounts({ date_range: { from: "", to: "" } }), {
      wrapper,
    });

    await waitFor(() => expect(read).toHaveBeenCalled());
    expect(read.mock.calls[0][0]).toBe("/app/api/symptoms/counts");
  });

  it("reads nothing while disabled", async () => {
    const { result } = renderHook(() => useSymptomCounts({}, false), {
      wrapper,
    });

    await Promise.resolve();
    expect(read).not.toHaveBeenCalled();
    expect(result.current.counts).toBeUndefined();
  });
});
