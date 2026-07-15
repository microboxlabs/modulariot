import { describe, expect, it } from "vitest";
import { createMiotConnectionClient } from "../index.js";
import type { GpsWebhookResponse, GpsWebhookTestResponse } from "../types.js";
import { createMockFetch } from "./test-utils.js";

const BASE_URL = "https://api.example.com";
const ORG_ID = "org-1";
const HOOKS = `/api/v1/orgs/${ORG_ID}/integrations/gps-webhooks`;

const sample: GpsWebhookResponse = {
  id: "sub-1",
  tenantCode: "tenant-1",
  connectionId: "conn-1",
  name: "ops-forward",
  url: "https://customer.example/hooks/gps",
  enabled: true,
  filterMode: "RULES",
  filter: { match: "ALL", scopes: { assetIds: ["GZKD49"] } },
  includeAllVisible: false,
  compiledAssetIds: ["GZKD49"],
  compiledAt: "2026-07-09T12:00:00Z",
  createdAt: "2026-07-09T12:00:00Z",
  updatedAt: "2026-07-09T12:00:00Z",
};

describe("gpsWebhooks", () => {
  it("list sends GET to /gps-webhooks", async () => {
    const { fn, call } = createMockFetch([sample]);
    const client = createMiotConnectionClient({
      baseUrl: BASE_URL,
      organizationId: ORG_ID,
      fetch: fn,
    });

    const result = await client.gpsWebhooks.list();

    expect(call.init.method).toBe("GET");
    expect(call.url).toBe(`${BASE_URL}${HOOKS}`);
    expect(result).toEqual([sample]);
  });

  it("create sends POST body", async () => {
    const { fn, call } = createMockFetch(sample);
    const client = createMiotConnectionClient({
      baseUrl: BASE_URL,
      organizationId: ORG_ID,
      fetch: fn,
    });

    const body = {
      name: "ops-forward",
      url: "https://customer.example/hooks/gps",
      filterMode: "RULES" as const,
      filter: { match: "ALL", scopes: { assetIds: ["GZKD49"] } },
      enabled: true,
    };
    await client.gpsWebhooks.create(body);

    expect(call.init.method).toBe("POST");
    expect(call.url).toBe(`${BASE_URL}${HOOKS}`);
    expect(JSON.parse(String(call.init.body))).toEqual(body);
  });

  it("test sends POST to /:id/test", async () => {
    const testResponse: GpsWebhookTestResponse = {
      success: true,
      statusCode: 200,
      message: "ok",
      testedAt: "2026-07-09T12:00:00Z",
    };
    const { fn, call } = createMockFetch(testResponse);
    const client = createMiotConnectionClient({
      baseUrl: BASE_URL,
      organizationId: ORG_ID,
      fetch: fn,
    });

    const result = await client.gpsWebhooks.test("sub-1");

    expect(call.init.method).toBe("POST");
    expect(call.url).toBe(`${BASE_URL}${HOOKS}/sub-1/test`);
    expect(result.success).toBe(true);
  });

  it("delete sends DELETE", async () => {
    const { fn, call } = createMockFetch(undefined, 204);
    const client = createMiotConnectionClient({
      baseUrl: BASE_URL,
      organizationId: ORG_ID,
      fetch: fn,
    });

    await client.gpsWebhooks.delete("sub-1");

    expect(call.init.method).toBe("DELETE");
    expect(call.url).toBe(`${BASE_URL}${HOOKS}/sub-1`);
  });
});
