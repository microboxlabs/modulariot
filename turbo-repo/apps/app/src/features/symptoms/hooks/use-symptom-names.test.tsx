import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import type { SymptomTableQuery } from "./use-symptom-names";

let mockSearchParams = new URLSearchParams();
const mockUseSymptomsTable = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/features/common/providers/client-api.provider", () => ({
  useSymptomsTable: (args: SymptomTableQuery) => mockUseSymptomsTable(args),
}));

const {
  useSymptomNames,
  usePublishSymptomNames,
  useSymptomTableQuery,
  toSymptomOptions,
  SYMPTOM_NAMES_KEY,
} = await import("./use-symptom-names");

const DICT: I18nRecord = {
  symptoms: {
    types: {
      "Lost Signal": "Perdida de reportabilidad GPS",
      "Speed Limit": "Exceso de límite de velocidad",
    },
  },
};

const QUERY: SymptomTableQuery = {
  page: 1,
  pageSize: 13,
  icu_code: "",
  trip_id: "",
  asset_id: "",
  driver_id: "",
  carrier_id: "",
  origin: "",
  destination: "",
  symptom_name: "",
  date_range: { from: "", to: "" },
};

beforeEach(() => {
  localStorage.clear();
  mockSearchParams = new URLSearchParams();
  mockUseSymptomsTable.mockReset();
  mockUseSymptomsTable.mockReturnValue({ tableData: undefined });
});

afterEach(cleanup);

describe("useSymptomTableQuery", () => {
  it("reads every filter off the URL", () => {
    mockSearchParams = new URLSearchParams(
      "trip_id=T1&asset_id=ABCD12&symptom_name=Lost Signal&date_from=2026-08-26 00:00:00&date_to=2026-08-26 23:59:59"
    );
    const { result } = renderHook(() => useSymptomTableQuery(2, 13));

    expect(result.current).toMatchObject({
      page: 2,
      pageSize: 13,
      trip_id: "T1",
      asset_id: "ABCD12",
      symptom_name: "Lost Signal",
      date_range: { from: "2026-08-26 00:00:00", to: "2026-08-26 23:59:59" },
    });
  });

  it("defaults absent params to empty strings", () => {
    const { result } = renderHook(() => useSymptomTableQuery(1, 13));

    expect(result.current.origin).toBe("");
    expect(result.current.symptom_name).toBe("");
    expect(result.current.date_range).toEqual({ from: "", to: "" });
  });
});

describe("usePublishSymptomNames", () => {
  it("queries with symptom_name cleared so the list is not narrowed by the selection", () => {
    renderHook(() =>
      usePublishSymptomNames({ ...QUERY, symptom_name: "Lost Signal" })
    );

    expect(mockUseSymptomsTable).toHaveBeenCalledWith(
      expect.objectContaining({ symptom_name: "" })
    );
  });

  it("keeps every other filter on the options query", () => {
    renderHook(() =>
      usePublishSymptomNames({
        ...QUERY,
        asset_id: "ABCD12",
        symptom_name: "Lost Signal",
        date_range: { from: "2026-08-26 00:00:00", to: "2026-08-26 23:59:59" },
      })
    );

    expect(mockUseSymptomsTable).toHaveBeenCalledWith(
      expect.objectContaining({
        asset_id: "ABCD12",
        date_range: { from: "2026-08-26 00:00:00", to: "2026-08-26 23:59:59" },
      })
    );
  });

  it("publishes the aggregated names and notifies readers in the same tab", () => {
    mockUseSymptomsTable.mockReturnValue({
      tableData: { symptoms_list: ["Lost Signal", "Speed Limit"] },
    });
    const listener = vi.fn();
    globalThis.addEventListener("localStorageUpdated", listener);

    renderHook(() => usePublishSymptomNames(QUERY));

    expect(localStorage.getItem(SYMPTOM_NAMES_KEY)).toBe(
      JSON.stringify(["Lost Signal", "Speed Limit"])
    );
    expect(listener).toHaveBeenCalledTimes(1);
    globalThis.removeEventListener("localStorageUpdated", listener);
  });

  it("does not re-notify when a revalidation returns the same names", () => {
    mockUseSymptomsTable.mockImplementation(() => ({
      // A fresh array each render, as SWR hands back.
      tableData: { symptoms_list: ["Lost Signal"] },
    }));
    const listener = vi.fn();
    globalThis.addEventListener("localStorageUpdated", listener);

    const { rerender } = renderHook(() => usePublishSymptomNames(QUERY));
    rerender();
    rerender();

    expect(listener).toHaveBeenCalledTimes(1);
    globalThis.removeEventListener("localStorageUpdated", listener);
  });

  it("empties the list when the scope has no symptoms", () => {
    localStorage.setItem(SYMPTOM_NAMES_KEY, JSON.stringify(["Lost Signal"]));
    mockUseSymptomsTable.mockReturnValue({ tableData: { symptoms_list: [] } });

    renderHook(() => usePublishSymptomNames(QUERY));

    // Keeping the old list would offer symptoms that cannot match anything.
    expect(localStorage.getItem(SYMPTOM_NAMES_KEY)).toBe("[]");
  });

  it("treats an absent symptom_name_list as none — the API omits it on no match", () => {
    localStorage.setItem(SYMPTOM_NAMES_KEY, JSON.stringify(["Lost Signal"]));
    mockUseSymptomsTable.mockReturnValue({ tableData: { data: [] } });

    renderHook(() => usePublishSymptomNames(QUERY));

    expect(localStorage.getItem(SYMPTOM_NAMES_KEY)).toBe("[]");
  });

  it("publishes nothing while the first response is still in flight", () => {
    localStorage.setItem(SYMPTOM_NAMES_KEY, JSON.stringify(["Lost Signal"]));
    mockUseSymptomsTable.mockReturnValue({ tableData: undefined });

    renderHook(() => usePublishSymptomNames(QUERY));

    expect(localStorage.getItem(SYMPTOM_NAMES_KEY)).toBe(
      JSON.stringify(["Lost Signal"])
    );
  });
});

describe("useSymptomNames", () => {
  it("reads the published list already in storage", () => {
    localStorage.setItem(
      SYMPTOM_NAMES_KEY,
      JSON.stringify(["Lost Signal", "Speed Limit"])
    );
    const { result } = renderHook(() => useSymptomNames());

    expect(result.current).toEqual(["Lost Signal", "Speed Limit"]);
  });

  it("starts empty and picks up a list published after mount", () => {
    const { result } = renderHook(() => useSymptomNames());
    expect(result.current).toEqual([]);

    act(() => {
      localStorage.setItem(
        SYMPTOM_NAMES_KEY,
        JSON.stringify(["Route Deviation"])
      );
      globalThis.dispatchEvent(new CustomEvent("localStorageUpdated"));
    });

    expect(result.current).toEqual(["Route Deviation"]);
  });

  it("ignores a malformed payload", () => {
    localStorage.setItem(SYMPTOM_NAMES_KEY, "{not json");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { result } = renderHook(() => useSymptomNames());

    expect(result.current).toEqual([]);
    consoleError.mockRestore();
  });

  it("drops non-string entries", () => {
    localStorage.setItem(
      SYMPTOM_NAMES_KEY,
      JSON.stringify(["Lost Signal", 7, null])
    );
    const { result } = renderHook(() => useSymptomNames());

    expect(result.current).toEqual(["Lost Signal"]);
  });
});

describe("toSymptomOptions", () => {
  it("builds label/value options translated through symptoms.types", () => {
    expect(toSymptomOptions(["Lost Signal", "Speed Limit"], DICT)).toEqual([
      { value: "Lost Signal", label: "Perdida de reportabilidad GPS" },
      { value: "Speed Limit", label: "Exceso de límite de velocidad" },
    ]);
  });

  it("falls back to the raw name when the key has no translation", () => {
    expect(toSymptomOptions(["Brand New Symptom"], DICT)).toEqual([
      { value: "Brand New Symptom", label: "Brand New Symptom" },
    ]);
  });
});
