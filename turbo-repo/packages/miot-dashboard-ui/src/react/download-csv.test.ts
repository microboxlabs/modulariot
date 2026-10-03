// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { downloadCsv } from "./download-csv";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("downloads with BOM, sanitizes filenames and releases temporary resources", () => {
  vi.useFakeTimers();
  const create = vi.fn<(blob: Blob) => string>(() => "blob:test");
  const revoke = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
  let filename = "";
  let attached = false;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    filename = this.download;
    attached = this.isConnected;
  });
  downloadCsv("Service;Cost\nSQL;10", "../Costs:2026.csv");
  expect(filename).toBe(".._Costs_2026.csv");
  expect(attached).toBe(true);
  expect(document.querySelector("a")).toBeNull();
  const blob = create.mock.calls[0]?.[0] as Blob | undefined;
  expect(blob?.type).toBe("text/csv;charset=utf-8;");
  expect(blob?.size).toBe(
    new TextEncoder().encode("\uFEFFService;Cost\nSQL;10").length,
  );
  expect(revoke).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1000);
  expect(revoke).toHaveBeenCalledWith("blob:test");
});
