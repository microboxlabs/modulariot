// @vitest-environment jsdom
import {
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SavedQueryProvider, usePlannerData } from "./saved-query-provider";
import type { SavedQueryOptions } from "./use-saved-query-results";
afterEach(cleanup);
function Reader({ name }: Readonly<{ name: string }>) {
  const result = usePlannerData("costs");
  const text = result.loading
    ? "Loading"
    : (result.error ?? result.rows[0]?.cost ?? "Empty");
  return <output aria-label={name}>{text}</output>;
}
function options(cost: number): SavedQueryOptions {
  return {
    client: {
      key: () => "/same-resource",
      query: vi.fn().mockResolvedValue([{ cost }]),
    },
    sessionKey: "session",
    slug: "costs",
    queries: [
      {
        id: "q",
        variableName: "costs",
        connectionId: "c",
        operationId: "o",
        parameters: {},
      },
    ],
    filters: {},
    refreshIntervalMs: 0,
    paused: false,
    errorMessage: "Query failed",
  };
}
it("isolates identical query names in sibling providers and leaves standalone widgets empty", async () => {
  render(
    <>
      <SavedQueryProvider {...options(42)}>
        <Reader name="First" />
      </SavedQueryProvider>
      <SavedQueryProvider {...options(7)}>
        <Reader name="Second" />
      </SavedQueryProvider>
      <Reader name="Standalone" />
    </>,
  );
  await waitFor(() =>
    expect(screen.getByLabelText("First").textContent).toBe("42"),
  );
  expect(screen.getByLabelText("Second").textContent).toBe("7");
  expect(screen.getByLabelText("Standalone").textContent).toBe("Empty");
});
it("removes prior results when the host replaces its authenticated session", async () => {
  const first = options(42);
  const view = render(
    <SavedQueryProvider {...first}>
      <Reader name="Result" />
    </SavedQueryProvider>,
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Result").textContent).toBe("42"),
  );
  const next = options(7);
  next.client.query = vi
    .fn()
    .mockRejectedValue(new Error("private transport detail"));
  view.rerender(
    <SavedQueryProvider {...next} sessionKey="replacement">
      <Reader name="Result" />
    </SavedQueryProvider>,
  );
  expect(screen.getByLabelText("Result").textContent).not.toBe("42");
  await waitFor(() =>
    expect(screen.getByLabelText("Result").textContent).toBe("Query failed"),
  );
});
it("keeps optional empty results stable and isolated per consumer", () => {
  const { result, rerender } = renderHook(() => ({
    a: usePlannerData(),
    b: usePlannerData("missing"),
  }));
  const first = result.current.a;
  first.rows.push({ accidentalMutation: "only this consumer" });
  expect(result.current.b.rows).toHaveLength(0);
  rerender();
  expect(result.current.a).toBe(first);
});
