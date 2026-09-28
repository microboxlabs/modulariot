import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modelLabel, useHarnessModels } from "./use-harness-models";

describe("modelLabel", () => {
  it("adds the multiplier only above 1", () => {
    const info = {
      default: "a",
      models: ["a", "b", "c"],
      multipliers: { a: 1, b: 3 },
    };
    expect(modelLabel(info, "a")).toBe("a");
    expect(modelLabel(info, "b")).toBe("b ×3");
    expect(modelLabel(info, "c")).toBe("c");
    expect(modelLabel({ default: null, models: ["a"] }, "a")).toBe("a");
  });
});

const STORAGE_KEY = "miot.harnessChat.models";

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    SWRConfig,
    { value: { provider: () => new Map(), shouldRetryOnError: false } },
    children
  );
}

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

describe("useHarnessModels", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the last good list when the harness is unreachable", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ default: "a", models: ["a", "b"] })
    );
    fetchMock.mockImplementation(() =>
      respond(502, { error: "models unavailable" })
    );

    const { result } = renderHook(() => useHarnessModels(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.models).toEqual(["a", "b"]);
    expect(result.current.default).toBe("a");
  });

  it("recovers on retry and stores the new list", async () => {
    fetchMock.mockImplementationOnce(() =>
      respond(502, { error: "models unavailable" })
    );
    const { result } = renderHook(() => useHarnessModels(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.models).toEqual([]);

    fetchMock.mockImplementationOnce(() =>
      respond(200, { default: "c", models: ["c"] })
    );
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.models).toEqual(["c"]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual({
      default: "c",
      models: ["c"],
    });
  });

  it("reports an empty list as ready, not as a failure", async () => {
    fetchMock.mockImplementation(() =>
      respond(200, { default: null, models: [] })
    );
    const { result } = renderHook(() => useHarnessModels(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.models).toEqual([]);
  });
});
