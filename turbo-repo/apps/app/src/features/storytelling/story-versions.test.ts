import { describe, expect, it } from "vitest";
import { versionChildren } from "./story-versions";
import type { StoryVersion } from "./storytelling.types";

function version(id: string, parentId: string | null): StoryVersion {
  return {
    id,
    storyId: "s1",
    parentId,
    label: id,
    summary: null,
    contentType: null,
    content: null,
    metadata: null,
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: "someone",
  };
}

describe("versionChildren", () => {
  it("groups versions by parent id, including the null-parent root", () => {
    const byParent = versionChildren([
      version("v1", null),
      version("v2", "v1"),
      version("v2a", "v2"),
      version("v3", "v2"),
    ]);
    expect(byParent.get(null)?.map((v) => v.id)).toEqual(["v1"]);
    expect(byParent.get("v2")?.map((v) => v.id)).toEqual(["v2a", "v3"]);
  });

  it("treats a version whose parent is missing as a root", () => {
    const byParent = versionChildren([
      version("v1", null),
      version("v9", "gone"),
    ]);
    expect(byParent.get(null)?.map((v) => v.id)).toEqual(["v1", "v9"]);
  });
});
