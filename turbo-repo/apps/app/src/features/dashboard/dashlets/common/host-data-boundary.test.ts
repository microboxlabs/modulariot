import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePgrestRows } from "./use-pgrest-rows";
import { useDynamicRows } from "./use-dynamic-rows";
import { usePgrestSettingsState } from "./use-pgrest-settings-state";

const state = vi.hoisted(() => ({ hosted: true }));
vi.mock("../../context/dashboard-context", () => ({
  useOptionalDashboard: () => ({
    hostAccess: state.hosted
      ? { canEdit: true, canManagePermissions: false }
      : undefined,
  }),
}));
const params: never[] = [];
const fetcher = vi.fn<typeof fetch>();
beforeEach(() => {
  state.hosted = true;
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());

describe("host dashboard data boundary", () => {
  it("refuses legacy PGREST and direct URL widget requests", () => {
    const pgrest = renderHook(() =>
      usePgrestRows("pgrest", "rpc/legacy", "GET", params)
    );
    const dynamic = renderHook(() => useDynamicRows("dynamic", "/legacy-api"));
    expect(fetcher).not.toHaveBeenCalled();
    expect(pgrest.result.current.rows).toEqual([]);
    expect(dynamic.result.current.rows).toEqual([]);
  });

  it("refuses legacy editor previews and introspection", async () => {
    const columns = vi.fn();
    const { result } = renderHook(() =>
      usePgrestSettingsState({
        pgrestFunctionName: "rpc/legacy",
        pgrestHttpMethod: "GET",
        pgrestParams: params,
        onColumnsDetected: () => [],
        setColumns: columns,
      })
    );
    await act(async () => {
      await result.current.detectColumns();
      await result.current.handleFunctionSelect("rpc/legacy");
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(columns).not.toHaveBeenCalled();
  });

  it("preserves the legacy page's PGREST behavior", async () => {
    state.hosted = false;
    fetcher.mockResolvedValue(Response.json([{ name: "Legacy" }]));
    const { result } = renderHook(() =>
      usePgrestRows("pgrest", "rpc/legacy", "GET", params)
    );
    await waitFor(() =>
      expect(result.current.rows).toEqual([{ name: "Legacy" }])
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("preserves the legacy page's direct URL behavior", async () => {
    state.hosted = false;
    fetcher.mockResolvedValue(Response.json([{ name: "Direct" }]));
    const { result } = renderHook(() =>
      useDynamicRows("dynamic", "/legacy-api")
    );
    await waitFor(() =>
      expect(result.current.rows).toEqual([{ name: "Direct" }])
    );
    expect(fetcher).toHaveBeenCalledExactlyOnceWith("/legacy-api");
  });
});
