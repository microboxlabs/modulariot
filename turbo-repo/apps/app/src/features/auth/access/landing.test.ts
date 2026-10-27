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

  it("skips the pages of the board BOARD_MODULE turns off", () => {
    const both = ["coordination:kanban.view", "trips:view"];
    expect(firstAllowedPage(both, "/shipping", "trips")).toBe(
      "/trips/dispatch"
    );
    expect(firstAllowedPage(both, "/shipping", "kanban")).toBe("/shipping");
    expect(firstAllowedPage(["trips:view"], "/shipping", "")).toBe(
      "/trips/dispatch"
    );
  });

  it("does not land on Where is my load or Collaborators with the trips model", () => {
    const legacy = ["coordination:loads.search", "collaborators:manage"];
    expect(firstAllowedPage(legacy, "/home", "trips")).toBeNull();
    expect(firstAllowedPage(legacy, "/home", "kanban")).toBe(
      "/where-is-my-load"
    );
  });
});
