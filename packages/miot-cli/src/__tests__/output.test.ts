import { describe, it, expect, vi, beforeEach } from "vitest";
import { printJson, printTable, printDetail, printSuccess } from "../output.js";

describe("printJson", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should print formatted JSON", () => {
    printJson({ id: "123", name: "test" });
    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify({ id: "123", name: "test" }, null, 2),
    );
  });

  it("should handle arrays", () => {
    printJson([1, 2, 3]);
    expect(console.log).toHaveBeenCalledWith(
      JSON.stringify([1, 2, 3], null, 2),
    );
  });

  it("should handle null", () => {
    printJson(null);
    expect(console.log).toHaveBeenCalledWith("null");
  });
});

describe("printTable", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should print aligned columns", () => {
    const rows = [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ];
    const columns = [
      { header: "ID", key: "id" },
      { header: "NAME", key: "name" },
    ];

    printTable(rows, columns);

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0]);
    expect(calls[0]).toBe("ID  NAME ");
    expect(calls[1]).toBe("--  -----");
    expect(calls[2]).toBe("1   Alice");
    expect(calls[3]).toBe("2   Bob  ");
  });

  it("should handle dot-path columns", () => {
    const rows = [
      { resource: { id: "r1" }, slot: { date: "2025-01-01" } },
    ];
    const columns = [
      { header: "RESOURCE", key: "resource.id" },
      { header: "DATE", key: "slot.date" },
    ];

    printTable(rows as unknown as Record<string, unknown>[], columns);

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0]);
    expect(calls[2]).toContain("r1");
    expect(calls[2]).toContain("2025-01-01");
  });

  it("should print message for empty data", () => {
    printTable([], [{ header: "ID", key: "id" }]);
    expect(console.log).toHaveBeenCalledWith("No results found.");
  });
});

describe("printDetail", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should print key-value pairs", () => {
    printDetail({ id: "123", name: "test" });

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0]);
    expect(calls[0]).toContain("id");
    expect(calls[0]).toContain("123");
    expect(calls[1]).toContain("name");
    expect(calls[1]).toContain("test");
  });

  it("should JSON-stringify nested objects", () => {
    printDetail({ resource: { id: "r1", type: "vehicle" } });

    const calls = vi.mocked(console.log).mock.calls.map((c) => c[0]);
    expect(calls[0]).toContain(JSON.stringify({ id: "r1", type: "vehicle" }));
  });

  it("should handle empty object", () => {
    printDetail({});
    expect(console.log).not.toHaveBeenCalled();
  });
});

describe("printSuccess", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should print success message", () => {
    printSuccess("Done!");
    expect(console.log).toHaveBeenCalledWith("Done!");
  });
});
