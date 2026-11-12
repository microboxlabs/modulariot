import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

const {
  readOperatorFilter,
  storeOperatorFilter,
  useOperatorFilter,
  useOperatorPagination,
} = await import("./use-operator-filter");
const { OPERATOR_FILTER_KEY, parseOperatorFilter } =
  await import("../model/operator-filter");

beforeEach(() => {
  localStorage.clear();
  mockSearchParams = new URLSearchParams();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("parseOperatorFilter", () => {
  it("reads the three values and nothing else", () => {
    expect(parseOperatorFilter("required")).toBe("required");
    expect(parseOperatorFilter(" none ")).toBe("none");
    expect(parseOperatorFilter("all")).toBe("all");
    expect(parseOperatorFilter("some")).toBeUndefined();
    expect(parseOperatorFilter("")).toBeUndefined();
    expect(parseOperatorFilter(null)).toBeUndefined();
  });
});

describe("the stored operator filter", () => {
  it("is 'required' when nothing is stored", () => {
    expect(readOperatorFilter()).toBe("required");
  });

  it("keeps the choice under its key", () => {
    storeOperatorFilter("none");

    expect(localStorage.getItem(OPERATOR_FILTER_KEY)).toBe("none");
    expect(readOperatorFilter()).toBe("none");
  });

  it("is 'required' when the stored value is not a filter", () => {
    localStorage.setItem(OPERATOR_FILTER_KEY, "everything");

    expect(readOperatorFilter()).toBe("required");
  });

  it("is 'required' when storage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(readOperatorFilter()).toBe("required");
  });

  it("does not throw when storage cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });

    expect(() => storeOperatorFilter("all")).not.toThrow();
  });
});

describe("useOperatorFilter", () => {
  it("defaults to 'required'", () => {
    const { result } = renderHook(() => useOperatorFilter());

    expect(result.current).toBe("required");
  });

  it("starts from the stored choice", () => {
    localStorage.setItem(OPERATOR_FILTER_KEY, "all");

    const { result } = renderHook(() => useOperatorFilter());

    expect(result.current).toBe("all");
  });

  it("follows a choice stored in this tab", () => {
    const { result } = renderHook(() => useOperatorFilter());

    act(() => storeOperatorFilter("none"));

    expect(result.current).toBe("none");
  });

  it("takes the URL's value over the stored one", () => {
    localStorage.setItem(OPERATOR_FILTER_KEY, "none");
    mockSearchParams = new URLSearchParams("operator=all");

    const { result } = renderHook(() => useOperatorFilter());

    expect(result.current).toBe("all");
  });

  it("ignores a URL value that is not a filter", () => {
    localStorage.setItem(OPERATOR_FILTER_KEY, "none");
    mockSearchParams = new URLSearchParams("operator=junk");

    const { result } = renderHook(() => useOperatorFilter());

    expect(result.current).toBe("none");
  });
});

describe("useOperatorPagination", () => {
  it("starts a new treatment filter on page one, preserving the operator scope", () => {
    mockSearchParams = new URLSearchParams("operator=none");
    const { result, rerender } = renderHook(() => useOperatorPagination());
    act(() => result.current.setCurrentPage(5));
    mockSearchParams = new URLSearchParams("operator=none&treatment=treated");
    rerender();
    expect(result.current.currentPage).toBe(1);
    act(() => result.current.setCurrentPage(2));
    expect(result.current.currentPage).toBe(2);
    mockSearchParams = new URLSearchParams("operator=none&treatment=untreated");
    rerender();
    expect(result.current.currentPage).toBe(1);
  });

  it("starts a new scope on page one when the URL changes", () => {
    const { result, rerender } = renderHook(() => useOperatorPagination());
    act(() => result.current.setCurrentPage(5));
    expect(result.current.currentPage).toBe(5);

    mockSearchParams = new URLSearchParams("operator=none");
    rerender();
    expect(result.current.currentPage).toBe(1);
    act(() => result.current.setCurrentPage(2));
    expect(result.current.currentPage).toBe(2);
    mockSearchParams = new URLSearchParams("operator=required");
    rerender();
    expect(result.current.currentPage).toBe(1);
  });

  it("starts on page one when the stored scope changes", () => {
    const { result } = renderHook(() => useOperatorPagination());
    act(() => result.current.setCurrentPage(5));
    act(() => storeOperatorFilter("none"));
    expect(result.current.currentPage).toBe(1);
  });
});
