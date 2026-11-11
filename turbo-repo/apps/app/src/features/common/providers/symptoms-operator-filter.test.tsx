import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";

const keys: string[] = [];

vi.mock("swr", () => ({
  default: (key: string | null) => {
    if (key) keys.push(key.replaceAll(/\s+/g, ""));
    return { data: undefined, error: undefined, isLoading: false };
  },
}));

const { useSymptoms, useSymptomsIcu, useSymptomsTable } =
  await import("./client-api.provider");

beforeEach(() => {
  keys.length = 0;
});

afterEach(cleanup);

describe("the operator filter in the symptom requests", () => {
  it.each(["required", "none", "all"] as const)(
    "sends %s to the list",
    (operator) => {
      renderHook(() => useSymptomsTable({ page: 2, pageSize: 13, operator }));

      expect(keys).toEqual([
        `/app/api/symptoms/table?page=2&limit=13&operator=${operator}`,
      ]);
    }
  );

  it.each(["required", "none", "all"] as const)(
    "sends %s to the counters",
    (operator) => {
      renderHook(() => useSymptoms(undefined, operator));

      expect(keys).toEqual([
        `/app/api/symptoms/dashboard?operator=${operator}`,
      ]);
    }
  );

  it("sends it to the counters of a date range", () => {
    renderHook(() =>
      useSymptoms({ from: "2026-10-01", to: "2026-10-02" }, "none")
    );

    expect(keys).toEqual([
      "/app/api/symptoms/dashboard?from=2026-10-01&to=2026-10-02&operator=none",
    ]);
  });

  it("sends it to a level's list", () => {
    renderHook(() => useSymptomsIcu("4", "all"));

    expect(keys).toEqual(["/app/api/symptoms/icu?p_icu_code=4&operator=all"]);
  });

  it("leaves it out for callers that do not filter", () => {
    renderHook(() => useSymptomsTable({ page: 1, pageSize: 10 }));
    renderHook(() => useSymptoms());
    renderHook(() => useSymptomsIcu());

    expect(keys).toEqual([
      "/app/api/symptoms/table?page=1&limit=10",
      "/app/api/symptoms/dashboard",
      "/app/api/symptoms/icu",
    ]);
  });
});
