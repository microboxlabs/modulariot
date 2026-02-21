import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MiotCalendarApiError } from "@microboxlabs/miot-calendar-client";
import { handleError } from "../utils/error.js";

describe("handleError", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should handle API 4xx error in json mode", () => {
    const err = new MiotCalendarApiError(404, {
      error: "Not Found",
      message: "Calendar not found",
      status: 404,
      timestamp: "2025-01-01T00:00:00Z",
    });

    handleError(err, "json");

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('"status": 404'),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should handle API 5xx error in json mode", () => {
    const err = new MiotCalendarApiError(500, {
      error: "Internal Server Error",
      message: "Something went wrong",
      status: 500,
      timestamp: "2025-01-01T00:00:00Z",
    });

    handleError(err, "json");

    expect(mockExit).toHaveBeenCalledWith(2);
  });

  it("should handle API error in table mode", () => {
    const err = new MiotCalendarApiError(400, {
      error: "Bad Request",
      message: "Invalid input",
      status: 400,
      timestamp: "2025-01-01T00:00:00Z",
    });

    handleError(err, "table");

    expect(console.error).toHaveBeenCalledWith("Error (400): Invalid input");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should handle API error with string body", () => {
    const err = new MiotCalendarApiError(502, "Bad Gateway");

    handleError(err, "json");

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Bad Gateway"),
    );
    expect(mockExit).toHaveBeenCalledWith(2);
  });

  it("should handle generic Error in json mode", () => {
    const err = new Error("Network failure");

    handleError(err, "json");

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Network failure"),
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should handle generic Error in table mode", () => {
    const err = new Error("Network failure");

    handleError(err, "table");

    expect(console.error).toHaveBeenCalledWith("Error: Network failure");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should handle non-Error values", () => {
    handleError("string error", "table");

    expect(console.error).toHaveBeenCalledWith("Error: string error");
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
