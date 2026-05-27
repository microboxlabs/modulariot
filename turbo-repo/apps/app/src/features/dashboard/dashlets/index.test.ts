import { describe, it, expect, vi } from "vitest";

vi.mock("@/features/geographic-view/components/layers/pin_layer_clustered", () => ({
  PinLayer: class PinLayer {},
}));

import {
  getDashlet,
  getAllDashlets,
  getAllDashletMetas,
  getDashletsByCategory,
  getValidDashletsForParent,
  canNestIn,
  getDefaultContainerVariant,
  getCategories,
  getCategoryLabel,
} from "./index";

describe("getDashlet", () => {
  it('returns definition for known componentId "container"', () => {
    const result = getDashlet("container");
    expect(result).toBeDefined();
    expect(result!.meta.id).toBe("container");
  });

  it('returns definition for known componentId "info_card"', () => {
    const result = getDashlet("info_card");
    expect(result).toBeDefined();
    expect(result!.meta.id).toBe("info_card");
  });

  it("returns undefined for unknown componentId", () => {
    expect(getDashlet("nonexistent_widget")).toBeUndefined();
  });
});

describe("getAllDashlets", () => {
  it("returns array of all registered dashlets", () => {
    const all = getAllDashlets();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(17);
  });
});

describe("getAllDashletMetas", () => {
  it("returns array of DashletMeta objects", () => {
    const metas = getAllDashletMetas();
    expect(metas.length).toBeGreaterThanOrEqual(17);
  });

  it("each meta has required fields: id, name, category", () => {
    const metas = getAllDashletMetas();
    for (const meta of metas) {
      expect(meta.id).toBeTruthy();
      expect(meta.name).toBeTruthy();
      expect(meta.category).toBeTruthy();
    }
  });
});

describe("getDashletsByCategory", () => {
  it('returns only container dashlets for "containers"', () => {
    const containers = getDashletsByCategory("containers");
    expect(containers.length).toBeGreaterThanOrEqual(1);
    for (const d of containers) {
      expect(d.meta.category).toBe("containers");
    }
  });

  it('returns data-display dashlets for "data-display"', () => {
    const dataDisplay = getDashletsByCategory("data-display");
    expect(dataDisplay.length).toBeGreaterThanOrEqual(1);
    for (const d of dataDisplay) {
      expect(d.meta.category).toBe("data-display");
    }
  });
});

describe("canNestIn", () => {
  it("returns false for unknown componentId", () => {
    expect(canNestIn("nonexistent", null)).toBe(false);
  });

  it("returns true for any component at root (parentComponentId=null)", () => {
    expect(canNestIn("info_card", null)).toBe(true);
    expect(canNestIn("container", null)).toBe(true);
  });

  it("returns true for non-container inside container", () => {
    expect(
      canNestIn("info_card", "container", undefined, { variant: "bento-box" }),
    ).toBe(true);
  });

  it("returns false for bento-box inside bento-box", () => {
    expect(
      canNestIn("container", "container", "bento-box", {
        variant: "bento-box",
      }),
    ).toBe(false);
  });

  it("returns true for labeled-group inside bento-box", () => {
    expect(
      canNestIn("container", "container", "labeled-group", {
        variant: "bento-box",
      }),
    ).toBe(true);
  });

  it("returns true for bento-box inside labeled-group", () => {
    expect(
      canNestIn("container", "container", "bento-box", {
        variant: "labeled-group",
      }),
    ).toBe(true);
  });
});

describe("getDefaultContainerVariant", () => {
  it('returns "bento-box" at root level (null)', () => {
    expect(getDefaultContainerVariant(null)).toBe("bento-box");
  });

  it('returns "labeled-group" when nested', () => {
    expect(getDefaultContainerVariant("container")).toBe("labeled-group");
  });
});

describe("getValidDashletsForParent", () => {
  it("returns all registered dashlets", () => {
    const all = getAllDashlets();
    const valid = getValidDashletsForParent(null);
    expect(valid.length).toBe(all.length);
  });
});

describe("getCategories", () => {
  it("returns unique category array", () => {
    const categories = getCategories();
    expect(new Set(categories).size).toBe(categories.length);
  });

  it('includes "containers" and "data-display"', () => {
    const categories = getCategories();
    expect(categories).toContain("containers");
    expect(categories).toContain("data-display");
  });
});

describe("getCategoryLabel", () => {
  it('maps "containers" -> "Containers"', () => {
    expect(getCategoryLabel("containers")).toBe("Containers");
  });

  it('maps "data-display" -> "Data Display"', () => {
    expect(getCategoryLabel("data-display")).toBe("Data Display");
  });
});
