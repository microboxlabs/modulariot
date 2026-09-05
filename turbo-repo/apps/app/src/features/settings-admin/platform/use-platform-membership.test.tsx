import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMyPlatformRoles } = vi.hoisted(() => ({
  fetchMyPlatformRoles: vi.fn(),
}));
vi.mock("./platform-data-service", () => ({ fetchMyPlatformRoles }));

import { useIsPlatformOwner } from "./use-platform-membership";

/** A cache per test, so one test's answer is not another's starting point. */
function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

beforeEach(() => {
  fetchMyPlatformRoles.mockReset();
});

describe("useIsPlatformOwner", () => {
  it("reports an owner once the roles arrive", async () => {
    fetchMyPlatformRoles.mockResolvedValue({ roleCodes: ["PLATFORM_OWNER"] });

    const { result } = renderHook(() => useIsPlatformOwner(), { wrapper });

    await waitFor(() => expect(result.current.isPlatformOwner).toBe(true));
  });

  it("is false before the answer arrives, so a gated surface never flashes", () => {
    fetchMyPlatformRoles.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useIsPlatformOwner(), { wrapper });

    expect(result.current.isPlatformOwner).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it("is false for a caller who holds no platform role", async () => {
    fetchMyPlatformRoles.mockResolvedValue({ roleCodes: [] });

    const { result } = renderHook(() => useIsPlatformOwner(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPlatformOwner).toBe(false);
  });

  it("fails closed when the request fails", async () => {
    fetchMyPlatformRoles.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useIsPlatformOwner(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPlatformOwner).toBe(false);
  });

  it("ignores a role the caller holds that is not platform ownership", async () => {
    fetchMyPlatformRoles.mockResolvedValue({ roleCodes: ["SOMETHING_ELSE"] });

    const { result } = renderHook(() => useIsPlatformOwner(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPlatformOwner).toBe(false);
  });
});
