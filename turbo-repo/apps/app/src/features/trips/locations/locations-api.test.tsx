import { renderHook, waitFor } from "@testing-library/react";
import { useMemo, type PropsWithChildren } from "react";
import { SWRConfig } from "swr";
import { describe, expect, it, vi } from "vitest";
import { tripsRequest } from "../monitors/monitors-api";
import { useLocations, type TripLocation } from "./locations-api";

vi.mock("../monitors/monitors-api", () => ({ tripsRequest: vi.fn() }));

function Cache({ children }: Readonly<PropsWithChildren>) {
  const value = useMemo(
    () => ({ provider: () => new Map(), dedupingInterval: 0 }),
    []
  );
  return <SWRConfig value={value}>{children}</SWRConfig>;
}

describe("location directory", () => {
  it("includes unlinked locations after the first full page", async () => {
    const linked: TripLocation[] = Array.from({ length: 200 }, (_, index) => ({
      id: `test-${index}`,
      name: `Test ${index}`,
      type: "zone",
      externalCode: null,
      geofenceId: 42,
      createdAt: null,
      updatedAt: null,
    }));
    const missing: TripLocation = {
      ...linked[0]!,
      id: "test-missing",
      geofenceId: null,
    };
    vi.mocked(tripsRequest)
      .mockResolvedValueOnce(linked)
      .mockResolvedValueOnce([missing]);
    const { result } = renderHook(() => useLocations("TEST"), {
      wrapper: Cache,
    });
    await waitFor(() => expect(result.current.data).toHaveLength(201));
    expect(
      result.current.data?.filter((location) => location.geofenceId === null)
    ).toEqual([missing]);
    expect(tripsRequest).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("&page=0")
    );
    expect(tripsRequest).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("&page=1")
    );
  });
});
