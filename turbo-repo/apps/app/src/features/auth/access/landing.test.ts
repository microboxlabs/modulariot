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

  it("does not land on the legacy dashboards when DASHBOARD_MODULE is server", () => {
    expect(
      firstAllowedPage(["dashboards:view"], "/home", "", "server")
    ).toBeNull();
    expect(firstAllowedPage(["dashboards:view"], "/home", "", "")).toBe(
      "/home"
    );
  });

  it("lands on server dashboards when Home is off and the server is enabled", () => {
    expect(
      firstAllowedPage(["dashboards:view"], "/home", "", "server", true)
    ).toBe("/dashboards");
  });

  it("uses the server dashboard's existing open route without opening arbitrary routes", () => {
    expect(firstAllowedPage([], "/fleet", "", "server", true)).toBe(
      "/dashboards"
    );
    expect(firstAllowedPage(null, "/fleet", "", "server", true)).toBe(
      "/dashboards"
    );
    expect(firstAllowedPage([], "/fleet", "", "legacy", true)).toBeNull();
    expect(firstAllowedPage([], "/fleet", "", "server", false)).toBeNull();
  });

  it("filters a preferred server dashboard and preserves existing module priorities", () => {
    expect(
      firstAllowedPage(
        ["dashboards:view"],
        "/dashboards/fleet",
        "",
        "legacy",
        true
      )
    ).toBe("/home");
    expect(
      firstAllowedPage(
        ["dashboards:view"],
        "/dashboards/fleet",
        "",
        "server",
        true
      )
    ).toBe("/dashboards/fleet");
    expect(
      firstAllowedPage(["coordination:reports.view"], "/shipping", "", "", true)
    ).toBe("/reports");
  });

  it("does not land on Where is my load or Collaborators with the trips model", () => {
    const legacy = ["coordination:loads.search", "collaborators:manage"];
    expect(firstAllowedPage(legacy, "/home", "trips")).toBeNull();
    expect(firstAllowedPage(legacy, "/home", "kanban")).toBe(
      "/where-is-my-load"
    );
  });
});
