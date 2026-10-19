// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useServerDashboardDynamicItems } from "./use-server-dashboard-dynamic-items";

vi.mock(
  "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes",
  () => ({ useOrgScopes: () => ({ activeOrg: { slug: "acme" } }) })
);
const fetcher = vi.fn<typeof fetch>();
beforeEach(() => {
  fetcher.mockResolvedValue(
    Response.json({ data: [{ slug: "centro de control", name: "Centro" }] })
  );
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => vi.unstubAllGlobals());
const wrapper = ({ children }: Readonly<PropsWithChildren>) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

it("links the active organization's dashboards", async () => {
  const { result } = renderHook(() => useServerDashboardDynamicItems(true), {
    wrapper,
  });
  await waitFor(() =>
    expect(result.current).toEqual([
      { href: "/dashboards/centro%20de%20control", label: "Centro" },
    ])
  );
  expect(fetcher).toHaveBeenCalledWith(
    "/app/api/dashboards?org=acme",
    expect.any(Object)
  );
});

it("does not call the dashboard server when the workspace is disabled", () => {
  const { result } = renderHook(() => useServerDashboardDynamicItems(false), {
    wrapper,
  });
  expect(result.current).toEqual([]);
  expect(fetcher).not.toHaveBeenCalled();
});
