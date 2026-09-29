import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardQueryDefinition } from "@microboxlabs/miot-dashboard-contract/document";
import { createDashboardServerClient } from "../services/dashboard-server-client";
import {
  DashboardQuerySession,
  SavedQueryResults,
} from "./saved-query-context";
import { usePlannerContext } from "./planner-context";

const state = vi.hoisted(() => ({
  filters: {} as Record<string, string>,
  refreshInterval: 0,
}));
vi.mock("./dashboard-context", () => ({
  useDashboard: () => ({
    refreshInterval: state.refreshInterval,
    editMode: false,
  }),
}));
vi.mock("./dashboard-filters-context", () => ({
  useDashboardFilters: () => ({ activeFilters: state.filters }),
}));
const query: DashboardQueryDefinition = {
  id: "costs",
  variableName: "billing",
  connectionId: "connection",
  operationId: "operation",
  parameters: {
    days: { kind: "filter", key: "days" },
    tenant: { kind: "literal", value: "fixed" },
  },
};
beforeEach(() => {
  state.filters = {};
  state.refreshInterval = 0;
});
function setup(queries = [query]) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      data: { rows: [{ cost: 3, empty: null, values: [1, "x"] }] },
    })
  );
  const client = createDashboardServerClient("one", fetcher);
  const wrapper = ({ children }: Readonly<PropsWithChildren>) => (
    <DashboardQuerySession
      sessionKey="test-session"
      client={client}
      slug="fleet"
      queries={queries}
      errorMessage="Translated error"
    >
      <SavedQueryResults>{children}</SavedQueryResults>
    </DashboardQuerySession>
  );
  return { fetcher, wrapper };
}

describe("saved query widget provider", () => {
  it("sends only declared filters to the org-bound saved-query route and derives schemas", async () => {
    state.filters = {
      days: "30",
      tenant: "forged",
      kiosk: "1",
      access_token: "ignored",
    };
    const { fetcher, wrapper } = setup();
    const { result } = renderHook(usePlannerContext, { wrapper });
    await waitFor(() =>
      expect(result.current.results.get("billing")?.loading).toBe(false)
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "/app/api/dashboards/fleet/queries/costs?org=one"
    );
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ filters: { days: "30" } })
    );
    expect(result.current.results.get("billing")?.rows).toEqual([
      { cost: "3", empty: "", values: '[1,"x"]' },
    ]);
    expect(result.current.schemas.get("billing")).toEqual([
      "cost",
      "empty",
      "values",
    ]);
  });

  it("aborts obsolete filters and ignores their late results", async () => {
    const { fetcher, wrapper } = setup();
    let release!: (response: Response) => void;
    fetcher.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const { result, rerender, unmount } = renderHook(usePlannerContext, {
      wrapper,
    });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    const original = fetcher.mock.calls[0]?.[1]?.signal;
    state.filters = { days: "7" };
    rerender();
    await waitFor(() =>
      expect(result.current.results.get("billing")?.loading).toBe(false)
    );
    expect(original?.aborted).toBe(true);
    await act(async () => {
      release(Response.json({ data: { rows: [{ stale: true }] } }));
    });
    expect(result.current.schemas.get("billing")).not.toContain("stale");
    const active = fetcher.mock.calls[1]?.[1]?.signal;
    unmount();
    expect(active?.aborted).toBe(true);
  });

  it("bounds concurrent queries and does not start queued work after unmount", async () => {
    const queries = Array.from({ length: 7 }, (_, i) => ({
      ...query,
      id: `q${i}`,
      variableName: `v${i}`,
    }));
    const { fetcher, wrapper } = setup(queries);
    const releases: ((response: Response) => void)[] = [];
    fetcher.mockImplementation(
      () =>
        new Promise((resolve) => {
          releases.push(resolve);
        })
    );
    const { unmount } = renderHook(usePlannerContext, { wrapper });
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4));
    unmount();
    await act(async () => {
      for (const release of releases)
        release(Response.json({ data: { rows: [] } }));
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("shows a translated generic error without provider details", async () => {
    const { fetcher, wrapper } = setup();
    fetcher.mockRejectedValue(new Error("private provider data"));
    const { result } = renderHook(usePlannerContext, { wrapper });
    await waitFor(() =>
      expect(result.current.results.get("billing")?.error).toBe(
        "Translated error"
      )
    );
    expect(result.current.results.get("billing")?.rows).toEqual([]);
  });
});

it("rejects ambiguous variable bindings before executing any query", async () => {
  const { fetcher, wrapper } = setup([query, { ...query, id: "other" }]);
  const { result } = renderHook(usePlannerContext, { wrapper });
  await waitFor(() =>
    expect(result.current.results.get("billing")?.error).toBe(
      "Translated error"
    )
  );
  expect(fetcher).not.toHaveBeenCalled();
});

it("preserves displayed rows while polling the same query", async () => {
  vi.useFakeTimers();
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  try {
    state.refreshInterval = 1;
    const { fetcher, wrapper } = setup();
    const { result, unmount } = renderHook(usePlannerContext, { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const previous = result.current.results.get("billing");
    expect(previous?.loading).toBe(false);
    let release!: (response: Response) => void;
    fetcher.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.results.get("billing")).toBe(previous);
    await act(async () => {
      release(Response.json({ data: { rows: [{ cost: 4 }] } }));
    });
    expect(result.current.results.get("billing")?.rows).toEqual([
      { cost: "4" },
    ]);
    unmount();
  } finally {
    hidden.mockRestore();
    vi.useRealTimers();
  }
});
