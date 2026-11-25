import { describe, expect, it } from "vitest";
import {
  addDashboard,
  addFolder,
  EMPTY_SNAPSHOT,
  patchDashboard,
  patchFolder,
  placeDashboard,
  removeDashboard,
  removeFolder,
  type ExplorerSnapshot,
} from "./explorer-snapshot";

const fleet = {
  id: "/dashboards/fleet",
  name: "Fleet",
  href: "/dashboards/fleet",
};
const sales = {
  id: "/dashboards/sales",
  name: "Sales",
  href: "/dashboards/sales",
};

const tree: ExplorerSnapshot = {
  sources: [fleet, sales],
  folders: {
    ops: { id: "ops", name: "Ops", parentId: null },
    daily: { id: "daily", name: "Daily", parentId: "ops" },
  },
  placements: { [fleet.id]: "daily" },
};

describe("explorer snapshot changes", () => {
  it("renames and moves a folder in place", () => {
    expect(patchFolder(tree, "daily", { name: "Night" }).folders.daily).toEqual(
      {
        id: "daily",
        name: "Night",
        parentId: "ops",
      }
    );
    expect(patchFolder(tree, "nope", { name: "X" })).toBe(tree);
  });

  it("removes a folder with what is below it", () => {
    const next = removeFolder(tree, "ops");
    expect(next.folders).toEqual({});
    expect(next.sources).toEqual([sales]);
    expect(next.placements).toEqual({});
  });

  it("adds, files, marks and removes dashboards", () => {
    const added = addDashboard(
      addFolder(EMPTY_SNAPSHOT, { id: "ops", name: "Ops", parentId: null }),
      fleet,
      "ops"
    );
    expect(added.placements).toEqual({ [fleet.id]: "ops" });
    expect(placeDashboard(added, fleet.id, null).placements).toEqual({});
    expect(
      patchDashboard(added, fleet.id, { starred: true, tags: ["a"] }).sources
    ).toEqual([{ ...fleet, starred: true, tags: ["a"] }]);
    expect(removeDashboard(added, fleet.id)).toMatchObject({
      sources: [],
      placements: {},
    });
  });
});
