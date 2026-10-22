import { describe, expect, it } from "vitest";
import { firstAllowedPage } from "./landing";

describe("firstAllowedPage", () => {
  it("lands on the deployment's home when it is allowed", () => {
    expect(
      firstAllowedPage(
        ["coordination:kanban.view", "calendar:view"],
        "/shipping"
      )
    ).toBe("/shipping");
  });

  it("falls back to the first allowed module page", () => {
    expect(firstAllowedPage(["calendar:plan"], "/shipping")).toBe("/calendar");
    expect(firstAllowedPage(["controltower:view"], "/shipping")).toBe(
      "/symptoms"
    );
  });

  it("is null with no permissions, or when they could not be loaded", () => {
    expect(firstAllowedPage([], "/shipping")).toBeNull();
    expect(firstAllowedPage(null, "/shipping")).toBeNull();
  });

  it("never lands on a page that needs no permission", () => {
    expect(firstAllowedPage([], "/fleet")).toBeNull();
  });
});
