import { describe, expect, it } from "vitest";
import {
  filterUsageRows,
  isFiltering,
  orgNamed,
  sortUsageRows,
  switcherOrgs,
  type UsageTenantRow,
} from "./usage-tenants-view";

const row = (
  slug: string,
  over: Partial<UsageTenantRow> = {}
): UsageTenantRow => ({
  slug,
  displayName: slug,
  taxId: null,
  isParent: true,
  ownQuota: null,
  quota: 100,
  subscribed: true,
  used: 0,
  providerCostUsd: null,
  chargeUsd: null,
  ...over,
});

const NO = { query: "", subscription: [], levels: [] };

describe("platform usage rows", () => {
  it("names an organization missing from the list by its slug", () => {
    expect(orgNamed(new Map(), "ghost").displayName).toBe("ghost");
  });

  it("shows the switcher's name, falling back to the technical name", () => {
    const [org] = switcherOrgs([
      {
        slug: "a",
        name: "a-tech",
        displayName: null,
        tenantClientId: "c",
        taxId: "1-9",
        parentSlug: "p",
      },
    ]);
    expect(org).toEqual({
      slug: "a",
      displayName: "a-tech",
      taxId: "1-9",
      isParent: false,
    });
  });

  it("filters by subscription and quota level", () => {
    const rows = [
      row("ok", { used: 10 }),
      row("alert", { used: 85 }),
      row("out", { used: 100, subscribed: false }),
    ];
    expect(
      filterUsageRows(rows, { ...NO, levels: ["alert"] }, 80).map((r) => r.slug)
    ).toEqual(["alert"]);
    expect(
      filterUsageRows(rows, { ...NO, subscription: ["unsubscribed"] }, 80).map(
        (r) => r.slug
      )
    ).toEqual(["out"]);
  });

  it("sorts by usage, then name", () => {
    const rows = [
      row("b", { used: 1 }),
      row("a", { used: 1 }),
      row("c", { used: 5 }),
    ];
    expect(sortUsageRows(rows, "USAGE_DESC").map((r) => r.slug)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("is filtering with a query, a badge or a mode", () => {
    expect(isFiltering(NO)).toBe(false);
    expect(isFiltering({ ...NO, query: " x " })).toBe(true);
    expect(isFiltering({ ...NO, modes: ["review"] })).toBe(true);
  });
});
