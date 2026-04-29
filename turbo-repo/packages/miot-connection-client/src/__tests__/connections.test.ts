import { describe, expect, it } from "vitest";
import { createMiotConnectionClient } from "../index.js";
import type {
  ConnectionTestResponse,
  IntegrationConnection,
  IntegrationOperation,
} from "../types.js";
import { createMockFetch } from "./test-utils.js";

const BASE_URL = "https://api.example.com";
const ORG_ID = "org-1";
const CONNECTIONS = `/api/v1/orgs/${ORG_ID}/integrations/connections`;

const sampleConnection: IntegrationConnection = {
  id: "conn-1",
  tenantCode: "tenant-1",
  name: "PostgREST",
  providerType: "POSTGREST",
  baseUrl: "https://postgrest.example.com",
  credentialProfileId: "profile-1",
  status: "DRAFT",
  lastTestedAt: null,
  lastTestResult: null,
  metadata: { service: "fleet" },
};

const sampleOperation: IntegrationOperation = {
  id: "op-1",
  connectionId: "conn-1",
  name: "List trucks",
  method: "GET",
  path: "/trucks",
  requestSchema: {},
  responseSchema: { type: "array" },
  testOperation: true,
};

describe("connections", () => {
  it("list sends GET to /connections", async () => {
    const { fn, call } = createMockFetch([sampleConnection]);
    const client = createMiotConnectionClient({
      baseUrl: BASE_URL,
      organizationId: ORG_ID,
      fetch: fn,
    });

    const result = await client.connections.list();

    expect(call.init.method).toBe("GET");
    expect(call.url).toBe(`${BASE_URL}${CONNECTIONS}`);
    expect(result).toEqual([sampleConnection]);
  });

  it("get sends GET to /connections/:id", async () => {
    const { fn, call } = createMockFetch(sampleConnection);
    const client = createMiotConnectionClient({
      baseUrl: BASE_URL,
      organizationId: ORG_ID,
      fetch: fn,
    });

    const result = await client.connections.get("conn-1");

    expect(call.init.method).toBe("GET");
    expect(call.url).toBe(`${BASE_URL}${CONNECTIONS}/conn-1`);
    expect(result).toEqual(sampleConnection);
  });

  it("create sends POST with body", async () => {
    const { fn, call } = createMockFetch(sampleConnection);
    const client = createMiotConnectionClient({
      baseUrl: BASE_URL,
      organizationId: ORG_ID,
      fetch: fn,
    });
    const body = {
      name: "PostgREST",
      providerType: "POSTGREST" as const,
      baseUrl: "https://postgrest.example.com",
      credentialProfileId: "profile-1",
      metadata: { service: "fleet" },
    };

    await client.connections.create(body);

    expect(call.init.method).toBe("POST");
    expect(call.url).toBe(`${BASE_URL}${CONNECTIONS}`);
    expect(call.init.body).toBe(JSON.stringify(body));
  });

  it("test sends POST to /connections/:id/test", async () => {
    const response: ConnectionTestResponse = {
      success: true,
      testedAt: "2026-01-01T00:00:00Z",
      message: "Connection contract is valid for GET /health; runtime probe pending",
    };
    const { fn, call } = createMockFetch(response);
    const client = createMiotConnectionClient({
      baseUrl: BASE_URL,
      organizationId: ORG_ID,
      fetch: fn,
    });
    const body = { method: "GET", path: "/health" };

    const result = await client.connections.test("conn-1", body);

    expect(call.init.method).toBe("POST");
    expect(call.url).toBe(`${BASE_URL}${CONNECTIONS}/conn-1/test`);
    expect(call.init.body).toBe(JSON.stringify(body));
    expect(result).toEqual(response);
  });

  it("listOperations sends GET to /connections/:id/operations", async () => {
    const { fn, call } = createMockFetch([sampleOperation]);
    const client = createMiotConnectionClient({
      baseUrl: BASE_URL,
      organizationId: ORG_ID,
      fetch: fn,
    });

    const result = await client.connections.listOperations("conn-1");

    expect(call.init.method).toBe("GET");
    expect(call.url).toBe(`${BASE_URL}${CONNECTIONS}/conn-1/operations`);
    expect(result).toEqual([sampleOperation]);
  });

  it("createOperation sends POST with body", async () => {
    const { fn, call } = createMockFetch(sampleOperation);
    const client = createMiotConnectionClient({
      baseUrl: BASE_URL,
      organizationId: ORG_ID,
      fetch: fn,
    });
    const body = {
      name: "List trucks",
      method: "GET",
      path: "/trucks",
      requestSchema: {},
      responseSchema: { type: "array" },
      testOperation: true,
    };

    await client.connections.createOperation("conn-1", body);

    expect(call.init.method).toBe("POST");
    expect(call.url).toBe(`${BASE_URL}${CONNECTIONS}/conn-1/operations`);
    expect(call.init.body).toBe(JSON.stringify(body));
  });
});
