import { describe, it, expect } from "vitest";
import { resolveLiveClient } from "./live-client";

describe("resolveLiveClient", () => {
  it("takes a live abbreviation over a stale stored name", () => {
    expect(resolveLiveClient({ client: "NEW" }, "OLD")).toBe("NEW");
  });

  it("fills a blank client from the customer code", () => {
    expect(resolveLiveClient({ clientCode: "C-4471" }, "")).toBe("C-4471");
    expect(resolveLiveClient({ clientCode: "C-4471" }, undefined)).toBe(
      "C-4471"
    );
  });

  // The whole point of the change is that a code must never sit in the client
  // slot. The next planner write persists what the UI renders, so letting a
  // customer code win here would bake it into the booking.
  it("never lets a customer code overwrite a stored name", () => {
    expect(resolveLiveClient({ clientCode: "C-4471" }, "ACME")).toBeUndefined();
  });

  it("prefers the abbreviation over the code when the task has both", () => {
    expect(
      resolveLiveClient({ client: "ACME", clientCode: "C-4471" }, "")
    ).toBe("ACME");
  });

  it("has nothing to say without a live task", () => {
    expect(resolveLiveClient(undefined, "")).toBeUndefined();
    expect(resolveLiveClient(undefined, "ACME")).toBeUndefined();
  });

  it("has nothing to say when the task carries neither carrier", () => {
    expect(resolveLiveClient({}, "")).toBeUndefined();
  });
});
