import { describe, expect, it } from "vitest";

import { type DashboardErrorCode, STATUS_BY_CODE } from "./errors";

/**
 * Kept as a literal list rather than derived from `STATUS_BY_CODE`, so that
 * adding a code without deciding its status fails here instead of passing by
 * construction. TypeScript makes the list itself exhaustive.
 */
const ALL_CODES: readonly DashboardErrorCode[] = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "BAD_REQUEST",
  "CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "UPSTREAM_ERROR",
  "INTERNAL_ERROR",
];

describe("STATUS_BY_CODE", () => {
  it("has a status for every code, and no others", () => {
    expect(Object.keys(STATUS_BY_CODE).sort()).toEqual([...ALL_CODES].sort());
  });

  /**
   * A client decides whether to retry, re-authenticate or give up from the
   * status class. A code landing in the wrong one sends it down the wrong
   * path no matter how clear the message is.
   */
  it.each([
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["BAD_REQUEST", 400],
    ["CONFLICT", 409],
    ["PAYLOAD_TOO_LARGE", 413],
    ["UPSTREAM_ERROR", 502],
    ["INTERNAL_ERROR", 500],
  ] as const)("reports %s as %i", (code, status) => {
    expect(STATUS_BY_CODE[code]).toBe(status);
  });

  /**
   * A shared module-level object in a long-lived server process: one caller
   * writing through it would change what every later request reports.
   */
  it("cannot be written through", () => {
    expect(Object.isFrozen(STATUS_BY_CODE)).toBe(true);
  });
});
