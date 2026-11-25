import { describe, expect, it } from "vitest";
import { folderChain } from "./use-dashboard-folder-path";

const folders = [
  { id: "ops", name: "Ops", parentId: null },
  { id: "daily", name: "Daily", parentId: "ops" },
  { id: "loop", name: "Loop", parentId: "loop" },
];

describe("folderChain", () => {
  it("lists the folder and the ones above it, top first", () => {
    expect(folderChain(folders, "daily")).toEqual([
      { id: "ops", name: "Ops" },
      { id: "daily", name: "Daily" },
    ]);
  });

  it("is empty at the top level and for a folder that is gone", () => {
    expect(folderChain(folders, null)).toEqual([]);
    expect(folderChain(folders, "nope")).toEqual([]);
  });

  it("stops at a cycle instead of hanging", () => {
    expect(folderChain(folders, "loop")).toEqual([
      { id: "loop", name: "Loop" },
    ]);
  });
});
