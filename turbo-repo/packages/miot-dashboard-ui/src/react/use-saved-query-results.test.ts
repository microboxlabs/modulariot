// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type {
  DashboardQueryDefinition,
  DashboardQueryValue,
} from "@microboxlabs/miot-dashboard-contract/document";
import {
  useSavedQueryResults,
  type SavedQueryOptions,
} from "./use-saved-query-results";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const query: DashboardQueryDefinition = {
  id: "q",
  variableName: "costs",
  connectionId: "c",
  operationId: "o",
  parameters: { days: { kind: "filter", key: "days" } },
};
function setup() {
  const execute = vi
    .fn<SavedQueryOptions["client"]["query"]>()
    .mockResolvedValue([{ cost: 10, empty: null, list: [1, "x"] }]);
  const client = { key: () => "/same-resource", query: execute };
  const options: SavedQueryOptions = {
    client,
    sessionKey: "first-session",
    slug: "costs",
    queries: [query],
    filters: { days: "30", token: "private" },
    refreshIntervalMs: 0,
    paused: false,
    errorMessage: "Query failed",
  };
  return { execute, options };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it("sends only declared filters and normalizes scalar/array results", async () => {
  const { execute, options } = setup();
  const { result } = renderHook(() => useSavedQueryResults(options));
  await waitFor(() =>
    expect(result.current.results.get("costs")?.loading).toBe(false),
  );
  expect(execute).toHaveBeenCalledWith(
    "costs",
    "q",
    { days: "30" },
    expect.any(AbortSignal),
  );
  expect(result.current.results.get("costs")?.rows).toEqual([
    { cost: "10", empty: "", list: '[1,"x"]' },
  ]);
  expect(result.current.schemas.get("costs")).toEqual([
    "cost",
    "empty",
    "list",
  ]);
  expect(result.current.definitions[0]?.id).toBe("q");
});

it.each(["session", "client", "filters"] as const)(
  "masks old rows and ignores late results when %s changes",
  async (change) => {
    const { execute, options } = setup();
    const pending = deferred<Record<string, DashboardQueryValue>[]>();
    execute.mockImplementationOnce(() => pending.promise);
    const { result, rerender, unmount } = renderHook(
      (input: SavedQueryOptions) => useSavedQueryResults(input),
      { initialProps: options },
    );
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    const oldSignal = execute.mock.calls[0]?.[3];
    const next = { ...options };
    if (change === "session") next.sessionKey = "second-session";
    if (change === "client") next.client = { ...options.client };
    if (change === "filters") next.filters = { days: "7" };
    rerender(next);
    expect(oldSignal?.aborted).toBe(true);
    await waitFor(() =>
      expect(result.current.results.get("costs")?.loading).toBe(false),
    );
    await act(async () =>
      pending.resolve([{ privateOldData: "must not appear" }]),
    );
    expect(result.current.results.get("costs")?.rows[0]).not.toHaveProperty(
      "privateOldData",
    );
    const activeSignal = execute.mock.calls[1]?.[3];
    unmount();
    expect(activeSignal?.aborted).toBe(true);
  },
);

it("hides already-loaded rows when a replacement client has the same URL", async () => {
  const { options } = setup();
  const { result, rerender } = renderHook(
    (input: SavedQueryOptions) => useSavedQueryResults(input),
    { initialProps: options },
  );
  await waitFor(() =>
    expect(result.current.results.get("costs")?.loading).toBe(false),
  );
  const pending = deferred<Record<string, DashboardQueryValue>[]>();
  rerender({
    ...options,
    client: { key: options.client.key, query: () => pending.promise },
  });
  expect(result.current.results.get("costs")?.rows).toEqual([]);
  await act(async () => pending.resolve([{ cost: 20 }]));
  expect(result.current.results.get("costs")?.rows).toEqual([{ cost: "20" }]);
});

it("uses four workers and starts no queued work after teardown", async () => {
  const { execute, options } = setup();
  const pending = Array.from({ length: 7 }, () =>
    deferred<Record<string, DashboardQueryValue>[]>(),
  );
  execute.mockImplementation((_slug, id) => pending[Number(id)]!.promise);
  const queries = Array.from({ length: 7 }, (_, id) => ({
    ...query,
    id: String(id),
    variableName: String(id),
  }));
  const { unmount } = renderHook(() =>
    useSavedQueryResults({ ...options, queries }),
  );
  await waitFor(() => expect(execute).toHaveBeenCalledTimes(4));
  await act(async () => pending[0]!.resolve([]));
  expect(execute).toHaveBeenCalledTimes(5);
  unmount();
  await act(async () => pending.forEach((item) => item.resolve([])));
  expect(execute).toHaveBeenCalledTimes(5);
  expect(execute.mock.calls.every((call) => call[3]?.aborted)).toBe(true);
});

it.each(["id", "variableName"] as const)(
  "rejects duplicate %s before executing requests",
  async (field) => {
    const { execute, options } = setup();
    const other = {
      ...query,
      id: "other",
      variableName: "other",
      [field]: query[field],
    };
    const { result } = renderHook(() =>
      useSavedQueryResults({ ...options, queries: [query, other] }),
    );
    await waitFor(() =>
      expect(result.current.results.get("costs")?.error).toBe("Query failed"),
    );
    expect(execute).not.toHaveBeenCalled();
  },
);

it("redacts execution errors and uses declared schema for empty rows", async () => {
  const { execute, options } = setup();
  execute.mockRejectedValue(new Error("private upstream details"));
  const { result } = renderHook(() =>
    useSavedQueryResults({
      ...options,
      queries: [{ ...query, schema: ["cost"] }],
    }),
  );
  await waitFor(() =>
    expect(result.current.results.get("costs")?.error).toBe("Query failed"),
  );
  expect(result.current.schemas.get("costs")).toEqual(["cost"]);
});

it("preserves prototype-named filters and ignores unrelated value changes", async () => {
  const { execute, options } = setup();
  const queries = [
    {
      ...query,
      parameters: { p: { kind: "filter" as const, key: "__proto__" } },
    },
  ];
  const filters = JSON.parse(
    '{"__proto__":"safe","unrelated":"first"}',
  ) as Record<string, string>;
  const { result, rerender } = renderHook(
    (input: SavedQueryOptions) => useSavedQueryResults(input),
    { initialProps: { ...options, queries, filters } },
  );
  await waitFor(() =>
    expect(result.current.results.get("costs")?.loading).toBe(false),
  );
  expect(
    Object.getOwnPropertyDescriptor(execute.mock.calls[0]?.[2], "__proto__")
      ?.value,
  ).toBe("safe");
  rerender({
    ...options,
    queries,
    filters: { ...filters, unrelated: "second" },
  });
  expect(execute).toHaveBeenCalledTimes(1);
});

it("keeps displayed rows during refresh and avoids overlapping polls", async () => {
  vi.useFakeTimers();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  const { execute, options } = setup();
  const { result, rerender } = renderHook(
    (input: SavedQueryOptions) => useSavedQueryResults(input),
    { initialProps: { ...options, refreshIntervalMs: 1000 } },
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  const previous = result.current.results.get("costs");
  expect(previous?.loading).toBe(false);
  const pending = deferred<Record<string, DashboardQueryValue>[]>();
  execute.mockImplementationOnce(() => pending.promise);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(execute).toHaveBeenCalledTimes(2);
  expect(result.current.results.get("costs")).toBe(previous);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(execute).toHaveBeenCalledTimes(2);
  await act(async () => pending.resolve([{ cost: 20 }]));
  expect(result.current.results.get("costs")?.rows).toEqual([{ cost: "20" }]);
  rerender({ ...options, refreshIntervalMs: 1000, paused: true });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(execute).toHaveBeenCalledTimes(2);
});

it("returns empty results without requests for an empty query list", async () => {
  const { execute, options } = setup();
  const { result } = renderHook(() =>
    useSavedQueryResults({ ...options, queries: [] }),
  );
  await act(async () => {});
  expect(result.current.results.size).toBe(0);
  expect(execute).not.toHaveBeenCalled();
});

it("shares the four request slots across rapidly replaced sessions", async () => {
  const { execute, options } = setup();
  const pending: ReturnType<
    typeof deferred<Record<string, DashboardQueryValue>[]>
  >[] = [];
  let active = 0;
  let maximum = 0;
  execute.mockImplementation(() => {
    const item = deferred<Record<string, DashboardQueryValue>[]>();
    pending.push(item);
    active++;
    maximum = Math.max(maximum, active);
    return item.promise.finally(() => {
      active--;
    });
  });
  const queries = Array.from({ length: 7 }, (_, id) => ({
    ...query,
    id: String(id),
    variableName: String(id),
  }));
  const { result, rerender, unmount } = renderHook(
    (input: SavedQueryOptions) => useSavedQueryResults(input),
    { initialProps: { ...options, queries } },
  );
  await waitFor(() => expect(execute).toHaveBeenCalledTimes(4));
  rerender({ ...options, queries, sessionKey: "second" });
  rerender({ ...options, queries, sessionKey: "third" });
  await act(async () => {});
  expect(execute).toHaveBeenCalledTimes(4);
  await act(async () => pending[0]!.resolve([{ obsolete: true }]));
  await waitFor(() => expect(execute).toHaveBeenCalledTimes(5));
  expect(maximum).toBe(4);
  expect(
    [...result.current.results.values()].every(
      (value) => value.rows.length === 0,
    ),
  ).toBe(true);
  unmount();
  await act(async () => pending.forEach((item) => item.resolve([])));
  expect(execute).toHaveBeenCalledTimes(5);
  expect(active).toBe(0);
});
