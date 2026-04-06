import { describe, it, expect } from "vitest";
import { createMiotResourceClient } from "../index.js";
import type { SyncCursor } from "../types.js";
import { createMockFetch } from "./test-utils.js";

const BASE_URL = "https://api.example.com";
const CURSOR = "/api/v1/sync/cursor";

const sampleCursor: SyncCursor = {
  sourceSystem: "erp",
  entityType: "DRIVER",
  cursorType: "timestamp",
  cursorValue: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-15T12:00:00Z",
};

describe("sync", () => {
  describe("getCursor", () => {
    it("sends GET to /sync/cursor/:sourceSystem/:entityType", async () => {
      const { fn, call } = createMockFetch(sampleCursor);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, organizationId: "org-1", fetch: fn });

      const result = await client.sync.getCursor("erp", "DRIVER");

      expect(call.init.method).toBe("GET");
      expect(call.url).toBe(`${BASE_URL}${CURSOR}/erp/DRIVER`);
      expect(result).toEqual(sampleCursor);
    });

    it("encodes path segments correctly", async () => {
      const { fn, call } = createMockFetch(sampleCursor);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, organizationId: "org-1", fetch: fn });

      await client.sync.getCursor("my-system", "TRUCK");

      expect(call.url).toBe(`${BASE_URL}${CURSOR}/my-system/TRUCK`);
    });
  });

  describe("advanceCursor", () => {
    it("sends PUT with body to /sync/cursor/:sourceSystem/:entityType", async () => {
      const { fn, call } = createMockFetch(sampleCursor);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, organizationId: "org-1", fetch: fn });
      const body = {
        cursorType: "timestamp",
        cursorValue: "2025-06-01T00:00:00Z",
        entitiesSynced: 150,
        errors: 0,
      };

      const result = await client.sync.advanceCursor("erp", "DRIVER", body);

      expect(call.init.method).toBe("PUT");
      expect(call.url).toBe(`${BASE_URL}${CURSOR}/erp/DRIVER`);
      expect(call.init.body).toBe(JSON.stringify(body));
      expect(result).toEqual(sampleCursor);
    });

    it("sends partial body when only some fields are provided", async () => {
      const { fn, call } = createMockFetch(sampleCursor);
      const client = createMiotResourceClient({ baseUrl: BASE_URL, organizationId: "org-1", fetch: fn });
      const body = { cursorValue: "2025-06-01T00:00:00Z" };

      await client.sync.advanceCursor("erp", "TRUCK", body);

      expect(call.init.body).toBe(JSON.stringify(body));
    });
  });
});
