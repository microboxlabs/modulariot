import { describe, expect, it } from "vitest";
import { describeError } from "./fetcher-error";
import { createFetcherError } from "./fetcher";
import { FetcherErrorCode } from "./fetcher.types";

describe("describeError", () => {
  it("reads the upstream message out of an object info with responseText", () => {
    const err = createFetcherError(
      "Request failed",
      403,
      FetcherErrorCode.ACTION_ERROR,
      { responseText: '{"status":false,"error":"API key no encontrada"}' }
    );
    expect(describeError(err)).toEqual({
      status: 403,
      code: "ACTION_ERROR",
      message: "API key no encontrada",
    });
  });

  it("does not throw when info is an object without JSON text", () => {
    const err = createFetcherError(
      "The request timed out. Please try again.",
      504,
      FetcherErrorCode.NETWORK_ERROR,
      { originalError: "fetch failed" }
    );
    expect(describeError(err)).toEqual({
      status: 504,
      code: "NETWORK_ERROR",
      message: "The request timed out. Please try again.",
    });
  });

  it("parses a string info", () => {
    const err = createFetcherError("x", 500, "SERVER_ERROR", '{"message":"boom"}');
    expect(describeError(err).message).toBe("boom");
  });

  it("maps AbortError to TIMEOUT", () => {
    const err = new Error("This operation was aborted");
    err.name = "AbortError";
    expect(describeError(err)).toEqual({
      status: 500,
      code: "TIMEOUT",
      message: "This operation was aborted",
    });
  });

  it("handles non-Error throwables", () => {
    expect(describeError("nope")).toEqual({
      status: 500,
      code: "UNKNOWN",
      message: "nope",
    });
  });
});
