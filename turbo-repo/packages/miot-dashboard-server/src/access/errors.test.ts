import { describe, expect, it } from "vitest";
import {
  DashboardServerError,
  STATUS_BY_CODE,
  isDashboardServerError,
  toErrorEnvelope,
} from "./errors";

describe("DashboardServerError", () => {
  it("derives the HTTP status from the code", () => {
    expect(DashboardServerError.unauthenticated().status).toBe(401);
    expect(DashboardServerError.forbidden("CAPABILITY", "no").status).toBe(403);
    expect(DashboardServerError.notFound().status).toBe(404);
    expect(DashboardServerError.badRequest("x").status).toBe(400);
    expect(DashboardServerError.conflict("x").status).toBe(409);
    expect(new DashboardServerError("UPSTREAM_ERROR", "x").status).toBe(502);
  });

  it("serializes to the shared envelope, with reason only on 403", () => {
    expect(
      DashboardServerError.forbidden("TENANT_SCOPE", "nope").toEnvelope(),
    ).toEqual({
      error: "nope",
      status: 403,
      code: "FORBIDDEN",
      reason: "TENANT_SCOPE",
    });
    expect(DashboardServerError.unauthenticated().toEnvelope()).toEqual({
      error: "Authentication required",
      status: 401,
      code: "UNAUTHENTICATED",
    });
    expect(
      "reason" in DashboardServerError.unauthenticated().toEnvelope(),
    ).toBe(false);
  });

  it("is a real Error with a cause", () => {
    const cause = new Error("upstream");
    const error = new DashboardServerError("UPSTREAM_ERROR", "x", { cause });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("DashboardServerError");
    expect(error.cause).toBe(cause);
    expect(isDashboardServerError(error)).toBe(true);
    expect(isDashboardServerError(cause)).toBe(false);
  });
});

describe("toErrorEnvelope", () => {
  it("passes package errors through", () => {
    const error = DashboardServerError.conflict("stale");
    expect(toErrorEnvelope(error)).toEqual(error.toEnvelope());
  });

  it("never forwards a foreign error's message", () => {
    const leaky = new Error("postgres://user:secret@db/miot failed");
    expect(toErrorEnvelope(leaky)).toEqual({
      error: "An unexpected error occurred",
      status: STATUS_BY_CODE.INTERNAL_ERROR,
      code: "INTERNAL_ERROR",
    });
    expect(JSON.stringify(toErrorEnvelope(leaky))).not.toContain("secret");
    expect(toErrorEnvelope("a string").code).toBe("INTERNAL_ERROR");
    expect(toErrorEnvelope(undefined).code).toBe("INTERNAL_ERROR");
  });
});
