import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  pageOf,
  tenantRows,
  tenantTotals,
  visibleRows,
} from "./geocoding-tenants-view";

const PLAN = {
  monthlyPriceUsd: 0,
  resolutionsPerMonth: 1000,
  overagePriceUsd: 0.005,
  alertPct: 80,
  enforced: false,
  updatedBy: null,
  updatedAt: null,
};

const ORGS = [
  {
    slug: "acme",
    name: "acme",
    displayName: "Transportes Acmé",
    tenantClientId: "c1",
    taxId: "76.123.456-7",
    parentSlug: null,
  },
  {
    slug: "beta",
    name: "Beta",
    displayName: null,
    tenantClientId: "c2",
    taxId: null,
    parentSlug: null,
  },
];

function usage(
  organization: string,
  used: number,
  quota: number | null,
  subscribed: boolean
) {
  return {
    organization,
    subscription: subscribed
      ? {
          monthlyQuota: quota,
          onExhausted: "overage" as const,
          updatedBy: null,
          updatedAt: null,
        }
      : null,
    usage: {
      periodStart: "2026-10-01T00:00:00Z",
      periodEnd: "2026-11-01T00:00:00Z",
      quota: subscribed ? (quota ?? 1000) : null,
      used,
      resolutions: used * 2,
      cacheHits: used,
      overageCalls: 0,
      overageUsd: 0,
      chargeUsd: subscribed ? 10 : null,
      providerCostUsd: used * 0.005,
      bySource: [],
    },
  };
}

describe("tenantRows", () => {
  it("names each organization and falls back to the plan's quota", () => {
    const rows = tenantRows(
      [
        usage("acme", 10, 500, true),
        usage("beta", 4, null, false),
        usage("gone", 1, null, false),
      ],
      ORGS,
      PLAN
    );

    expect(
      rows.map((r) => [r.displayName, r.quota, r.ownQuota, r.subscribed])
    ).toEqual([
      ["Transportes Acmé", 500, 500, true],
      ["Beta", 1000, null, false],
      ["gone", 1000, null, false],
    ]);
  });
});

describe("tenantTotals", () => {
  it("adds calls, cost and charge across organizations", () => {
    const totals = tenantTotals(
      tenantRows(
        [usage("acme", 10, 500, true), usage("beta", 4, null, false)],
        ORGS,
        PLAN
      )
    );

    expect(totals.subscribed).toBe(1);
    expect(totals.providerCalls).toBe(14);
    expect(totals.cacheHitPct).toBe(50);
    expect(totals.chargeUsd).toBe(10);
    expect(totals.providerCostUsd).toBeCloseTo(0.07);
  });
});

describe("visibleRows and pageOf", () => {
  it("finds an organization by name without accents or by tax id", () => {
    const rows = tenantRows(
      [usage("acme", 1, null, true), usage("beta", 9, null, true)],
      ORGS,
      PLAN
    );

    expect(visibleRows(rows, "acme transportes").map((r) => r.slug)).toEqual([
      "acme",
    ]);
    expect(visibleRows(rows, "761234567").map((r) => r.slug)).toEqual(["acme"]);
    expect(visibleRows(rows, "").map((r) => r.slug)).toEqual(["beta", "acme"]);
  });

  it("pages the rows", () => {
    const rows = Array.from({ length: PAGE_SIZE * 2 + 1 }, (_, i) => i);

    expect(pageOf(rows, 1).pages).toBe(3);
    expect(pageOf(rows, 3).rows).toEqual([PAGE_SIZE * 2]);
    expect(pageOf(rows, 9).rows).toEqual([PAGE_SIZE * 2]);
    expect(pageOf([], 1)).toEqual({ rows: [], pages: 1 });
  });
});
