import { describe, expect, it } from "vitest";
import { nextVersionLabel, subtreeIds, versionChildren, type StoryVersion } from "./story-versions";

describe("nextVersionLabel", () => {
  it("bumps the minor version of a parsable X.Y label", () => {
    expect(nextVersionLabel("2.0", new Set())).toBe("2.1");
    expect(nextVersionLabel("1.1", new Set())).toBe("1.2");
  });

  it("skips minors already taken within the same major", () => {
    expect(nextVersionLabel("2.0", new Set(["2.1", "2.2"]))).toBe("2.3");
  });

  it("falls back to '<label>.1' for a label with no leading X.Y at all", () => {
    expect(nextVersionLabel("draft", new Set())).toBe("draft.1");
  });

  it("increments the fallback suffix when it's already taken", () => {
    expect(nextVersionLabel("draft", new Set(["draft.1", "draft.2"]))).toBe("draft.3");
  });

  it("still parses the leading X.Y out of a suffixed label like '1.1a'", () => {
    // The regex only anchors the start, so "1.1a" reads as major=1, minor=1
    // (the trailing "a" is just along for the ride) — iterating off a
    // lettered branch label lands on the same next minor as its numeric
    // parent would.
    expect(nextVersionLabel("1.1a", new Set())).toBe("1.2");
  });
});

describe("versionChildren / subtreeIds", () => {
  const versions: StoryVersion[] = [
    { id: "v1", label: "1.0", parentId: null, createdAt: "2026-01-01", createdBy: "A", summary: "" },
    { id: "v2", label: "1.1", parentId: "v1", createdAt: "2026-01-02", createdBy: "A", summary: "" },
    { id: "v2a", label: "1.1a", parentId: "v2", createdAt: "2026-01-03", createdBy: "A", summary: "" },
    { id: "v3", label: "2.0", parentId: "v2", createdAt: "2026-01-04", createdBy: "A", summary: "" },
  ];

  it("groups versions by parent id, including the null-parent root", () => {
    const byParent = versionChildren(versions);
    expect(byParent.get(null)?.map((v) => v.id)).toEqual(["v1"]);
    expect(byParent.get("v2")?.map((v) => v.id).sort()).toEqual(["v2a", "v3"]);
  });

  it("collects a whole branch (a node and its descendants)", () => {
    expect(subtreeIds(versions, "v2")).toEqual(new Set(["v2", "v2a", "v3"]));
  });

  it("collects just the node itself when it has no children", () => {
    expect(subtreeIds(versions, "v2a")).toEqual(new Set(["v2a"]));
  });
});
