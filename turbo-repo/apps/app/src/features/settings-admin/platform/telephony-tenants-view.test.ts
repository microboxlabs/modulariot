import { describe, expect, it } from "vitest";
import type { OrgTelephonyUsage } from "@/features/telephony/telephony-plan";
import {
  NO_TELEPHONY_FILTERS,
  telephonyTenantRows,
  telephonyTotals,
  visibleTelephonyRows,
} from "./telephony-tenants-view";

function usage(
  tenantCode: string,
  monthlyMinutes: number | null,
  usedMinutes: number
): OrgTelephonyUsage {
  return {
    tenantCode,
    subscription:
      monthlyMinutes === null
        ? null
        : { monthlyMinutes, updatedBy: null, updatedAt: null },
    usage: {
      periodStart: "2026-11-01T00:00:00Z",
      periodEnd: "2026-12-01T00:00:00Z",
      quotaMinutes: monthlyMinutes ?? 300,
      usedMinutes,
      pending: 1,
      chargeUsd: usedMinutes / 10,
      providerCost: null,
      lines: [
        {
          channel: "WHATSAPP_CALL",
          destinationType: "WHATSAPP_CALL",
          calls: 3,
          seconds: 0,
          billedMinutes: 2,
          chargeUsd: 0,
          providerCost: null,
        },
        {
          channel: "WHATSAPP_TEMPLATE",
          destinationType: "WHATSAPP_TEMPLATE",
          calls: 7,
          seconds: 0,
          billedMinutes: 0,
          chargeUsd: 0,
          providerCost: null,
        },
      ],
    },
  };
}

const ORGS = [
  {
    slug: "acme",
    name: "acme",
    displayName: "Transportes Acme",
    tenantClientId: "client-acme",
    taxId: null,
    parentSlug: null,
  },
];

describe("telephony tenant rows", () => {
  it("uses the plan's minutes without own minutes, and names by slug or tenant client id", () => {
    const rows = telephonyTenantRows(
      [usage("acme", null, 10), usage("client-acme", 50, 60)],
      ORGS
    );
    expect(rows[0]).toMatchObject({
      slug: "acme",
      displayName: "Transportes Acme",
      ownQuota: null,
      quota: 300,
      subscribed: false,
      calls: 3,
    });
    expect(rows[1]).toMatchObject({
      slug: "client-acme",
      displayName: "Transportes Acme",
      subscribed: true,
    });
  });

  it("totals minutes, calls and pending, and filters exhausted organizations", () => {
    const rows = telephonyTenantRows(
      [usage("a", 50, 60), usage("b", null, 10)],
      []
    );
    expect(telephonyTotals(rows)).toMatchObject({
      ownMinutes: 1,
      minutes: 70,
      calls: 6,
      pending: 2,
      chargeUsd: 7,
    });
    expect(
      visibleTelephonyRows(
        rows,
        { ...NO_TELEPHONY_FILTERS, levels: ["exhausted"] },
        "USAGE_DESC"
      ).map((r) => r.slug)
    ).toEqual(["a"]);
  });
});
