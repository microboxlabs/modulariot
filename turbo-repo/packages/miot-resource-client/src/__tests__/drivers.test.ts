import { describe, it, expect } from "vitest";
import { createMiotResourceClient } from "../index.js";
import type { BulkSyncResponse, Driver, EntityEvent } from "../types.js";
import { createMockFetch } from "./test-utils.js";

const BASE_URL = "https://api.example.com";
const DRIVERS = "/api/v1/drivers";

const tenant = { id: 1, code: "t-1", name: "Tenant 1", active: true };

const sampleDriver: Driver = {
  id: 1, tenant, clientId: "c-1", entityId: "uuid-driver-1",
  externalId: "ext-driver-1", status: "ACTIVE", alfrescoNodeId: "node-1",
  active: true, createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z",
  firstName: "John", lastName: "Doe", rut: "12345678-9",
};

const sampleEvent: EntityEvent = {
  id: 10, clientId: "c-1", entityType: "DRIVER", entityId: "uuid-driver-1",
  eventType: "CREATED", eventSource: "api", actor: "user-1",
  payload: "{}", metadata: "{}", createdAt: "2025-01-01T00:00:00Z",
};

describe("drivers", () => {
  describe("list", () => {
    it("sends GET to /drivers", async () => {
      const { fn, call } = createMockFetch([sampleDriver]);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.drivers.list();

      expect(call.init.method).toBe("GET");
      expect(call.url).toBe(`${BASE_URL}${DRIVERS}`);
      expect(result).toEqual([sampleDriver]);
    });

    it("passes pagination params", async () => {
      const { fn, call } = createMockFetch([]);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      await client.drivers.list({ page: 1, size: 50 });

      const url = new URL(call.url);
      expect(url.searchParams.get("page")).toBe("1");
      expect(url.searchParams.get("size")).toBe("50");
    });
  });

  describe("get", () => {
    it("sends GET to /drivers/:id", async () => {
      const { fn, call } = createMockFetch(sampleDriver);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.drivers.get(1);

      expect(call.init.method).toBe("GET");
      expect(call.url).toBe(`${BASE_URL}${DRIVERS}/1`);
      expect(result).toEqual(sampleDriver);
    });
  });

  describe("create", () => {
    it("sends POST with body", async () => {
      const { fn, call } = createMockFetch(sampleDriver);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });
      const body = { firstName: "John", lastName: "Doe", rut: "12345678-9" };

      await client.drivers.create(body);

      expect(call.init.method).toBe("POST");
      expect(call.url).toBe(`${BASE_URL}${DRIVERS}`);
      expect(call.init.body).toBe(JSON.stringify(body));
    });
  });

  describe("update", () => {
    it("sends PUT with body to /drivers/:id", async () => {
      const { fn, call } = createMockFetch(sampleDriver);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });
      const body = { firstName: "Jane", phone: "+56912345678" };

      await client.drivers.update(1, body);

      expect(call.init.method).toBe("PUT");
      expect(call.url).toBe(`${BASE_URL}${DRIVERS}/1`);
      expect(call.init.body).toBe(JSON.stringify(body));
    });
  });

  describe("changeStatus", () => {
    it("sends PATCH to /drivers/:id/status", async () => {
      const { fn, call } = createMockFetch(sampleDriver);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      await client.drivers.changeStatus(1, { status: "BLOCKED", reason: "Compliance" });

      expect(call.init.method).toBe("PATCH");
      expect(call.url).toBe(`${BASE_URL}${DRIVERS}/1/status`);
      expect(call.init.body).toBe(JSON.stringify({ status: "BLOCKED", reason: "Compliance" }));
    });
  });

  describe("listEvents", () => {
    it("sends GET to /drivers/:id/events", async () => {
      const { fn, call } = createMockFetch([sampleEvent]);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.drivers.listEvents(1, { limit: 10 });

      expect(call.init.method).toBe("GET");
      expect(call.url).toContain(`${DRIVERS}/1/events`);
      expect(new URL(call.url).searchParams.get("limit")).toBe("10");
      expect(result).toEqual([sampleEvent]);
    });

    it("works without limit param", async () => {
      const { fn, call } = createMockFetch([sampleEvent]);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      await client.drivers.listEvents(1);

      expect(new URL(call.url).searchParams.has("limit")).toBe(false);
    });
  });

  describe("bulkSync", () => {
    const bulkResponse: BulkSyncResponse = {
      created: 2, updated: 1, skipped: 0, errors: [],
    };

    it("sends POST to /drivers/bulk-sync", async () => {
      const { fn, call } = createMockFetch(bulkResponse);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });
      const body = {
        sourceSystem: "erp",
        entities: [
          { externalId: "ext-1", fields: { firstName: "John" } },
          { externalId: "ext-2", fields: { firstName: "Jane" } },
        ],
      };

      const result = await client.drivers.bulkSync(body);

      expect(call.init.method).toBe("POST");
      expect(call.url).toBe(`${BASE_URL}${DRIVERS}/bulk-sync`);
      expect(call.init.body).toBe(JSON.stringify(body));
      expect(result).toEqual(bulkResponse);
    });

    it("returns counts and errors from response", async () => {
      const responseWithErrors: BulkSyncResponse = {
        created: 1, updated: 0, skipped: 0,
        errors: [{ externalId: "ext-bad", message: "Invalid RUT" }],
      };
      const { fn } = createMockFetch(responseWithErrors);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.drivers.bulkSync({ sourceSystem: "erp", entities: [] });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.externalId).toBe("ext-bad");
    });
  });
});
