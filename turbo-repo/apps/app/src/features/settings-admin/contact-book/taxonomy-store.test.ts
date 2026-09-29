import { beforeEach, describe, expect, it } from "vitest";
import { deleteBadge, ensureBadge, renameBadge } from "./taxonomy-store";

const stored = () => JSON.parse(window.localStorage.getItem("miot.prototype.contact-badges.v1") ?? "[]");

describe("badge store", () => {
  beforeEach(() => window.localStorage.clear());

  it("creates a badge once and reuses it ignoring case and accents", () => {
    const a = ensureBadge("Santiago");
    const b = ensureBadge("  santiágo ");
    expect(b.id).toBe(a.id);
    expect(stored()).toEqual([{ id: a.id, name: "Santiago" }]);
  });

  it("renames, refusing empty names and names used by another badge", () => {
    const a = ensureBadge("mintral");
    ensureBadge("santiago");
    expect(renameBadge(a.id, "Santiago")).toBe(false);
    expect(renameBadge(a.id, "  ")).toBe(false);
    expect(renameBadge(a.id, "Mintral SpA")).toBe(true);
    expect(stored()[0].name).toBe("Mintral SpA");
  });

  it("deletes a badge", () => {
    const a = ensureBadge("transportista");
    deleteBadge(a.id);
    expect(stored()).toEqual([]);
  });
});
