import { describe, expect, it } from "vitest";
import { folderAllows } from "./explorer-folder-roles";

describe("folderAllows", () => {
  it("follows Reader, Editor and Administrator", () => {
    expect(folderAllows({ role: "Consumer" }, "edit")).toBe(false);
    expect(folderAllows({ role: "Editor" }, "edit")).toBe(true);
    expect(folderAllows({ role: "Editor" }, "manage")).toBe(false);
    expect(folderAllows({ role: "Coordinator" }, "manage")).toBe(true);
  });

  it("leaves a folder with no role yet to the server", () => {
    expect(folderAllows({}, "manage")).toBe(true);
    expect(folderAllows(undefined, "edit")).toBe(true);
  });
});
