import { describe, expect, it } from "vitest";
import {
  formToCreateBody,
  GpsWebhookFormSchema,
  parseList,
  subscriptionToForm,
  summarizeFilter,
  type GpsWebhookSubscription,
} from "./gps-webhook.types";

const sample: GpsWebhookSubscription = {
  id: "sub-1",
  tenantCode: "t1",
  connectionId: "c1",
  name: "ops-forward",
  url: "https://customer.example/hooks/gps",
  enabled: true,
  filterMode: "RULES",
  filter: {
    match: "ALL",
    scopes: {
      allVisible: false,
      assetIds: ["GZKD49", "SVSX88"],
      gpsProviders: ["QuecLink"],
    },
  },
  includeAllVisible: false,
  compiledAssetIds: ["GZKD49", "SVSX88"],
  compiledAt: "2026-07-09T12:00:00Z",
  createdAt: "2026-07-09T12:00:00Z",
  updatedAt: "2026-07-09T12:00:00Z",
};

describe("gps-webhook.types", () => {
  it("parseList splits comma and newline values", () => {
    expect(parseList("A, B\nC")).toEqual(["A", "B", "C"]);
  });

  it("subscriptionToForm maps scopes to text fields", () => {
    const form = subscriptionToForm(sample);
    expect(form.name).toBe("ops-forward");
    expect(form.filterMode).toBe("RULES");
    expect(form.assetIds).toContain("GZKD49");
    expect(form.gpsProviders).toContain("QuecLink");
  });

  it("formToCreateBody builds RULES filter payload", () => {
    const body = formToCreateBody({
      name: "ops-forward",
      url: "https://customer.example/hooks/gps",
      filterMode: "RULES",
      assetIds: "GZKD49\nSVSX88",
      carrierIds: "",
      ingestClientIds: "",
      gpsProviders: "QuecLink",
      owners: "",
      enabled: true,
    });
    expect(body.filterMode).toBe("RULES");
    expect(body.filter.scopes?.assetIds).toEqual(["GZKD49", "SVSX88"]);
    expect(body.filter.scopes?.gpsProviders).toEqual(["QuecLink"]);
  });

  it("schema rejects empty RULES", () => {
    const result = GpsWebhookFormSchema.safeParse({
      name: "x",
      url: "https://example.com/hook",
      filterMode: "RULES",
      assetIds: "",
      carrierIds: "",
      ingestClientIds: "",
      gpsProviders: "",
      owners: "",
      enabled: true,
    });
    expect(result.success).toBe(false);
  });

  it("schema accepts ALL_VISIBLE without lists", () => {
    const result = GpsWebhookFormSchema.safeParse({
      name: "x",
      url: "https://example.com/hook",
      filterMode: "ALL_VISIBLE",
      assetIds: "",
      carrierIds: "",
      ingestClientIds: "",
      gpsProviders: "",
      owners: "",
      enabled: true,
    });
    expect(result.success).toBe(true);
  });

  it("summarizeFilter reports all visible", () => {
    expect(
      summarizeFilter({
        ...sample,
        filterMode: "ALL_VISIBLE",
        includeAllVisible: true,
      }),
    ).toBe("allVisible");
  });
});
