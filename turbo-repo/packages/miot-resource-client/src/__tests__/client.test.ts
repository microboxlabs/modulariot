import { describe, it, expect } from "vitest";
import { createMiotResourceClient, MiotResourceApiError } from "../index.js";
import type { ErrorResponse } from "../types.js";
import { createMockFetch } from "./test-utils.js";

describe("createMiotResourceClient", () => {
  const baseUrl = "https://api.example.com";

  describe("URL building", () => {
    it("builds a full URL from baseUrl and path", async () => {
      const { fn, call } = createMockFetch([]);
      const client = createMiotResourceClient({ baseUrl, organizationId: "org-1", fetch: fn });

      await client.fleet.listTrucks();

      expect(call.url).toBe("https://api.example.com/api/v1/orgs/org-1/fleet/trucks");
    });

    it("appends query parameters", async () => {
      const { fn, call } = createMockFetch([]);
      const client = createMiotResourceClient({ baseUrl, organizationId: "org-1", fetch: fn });

      await client.fleet.listTrucks({ page: 1, size: 10 });

      const url = new URL(call.url);
      expect(url.searchParams.get("page")).toBe("1");
      expect(url.searchParams.get("size")).toBe("10");
    });

    it("omits undefined query values", async () => {
      const { fn, call } = createMockFetch([]);
      const client = createMiotResourceClient({ baseUrl, organizationId: "org-1", fetch: fn });

      await client.fleet.listTrucks({ page: 0, size: undefined });

      const url = new URL(call.url);
      expect(url.searchParams.get("page")).toBe("0");
      expect(url.searchParams.has("size")).toBe(false);
    });
  });

  describe("request headers", () => {
    it("sends config-level headers on every request", async () => {
      const { fn, call } = createMockFetch([]);
      const client = createMiotResourceClient({
        baseUrl,
        organizationId: "org-1",
        fetch: fn,
        headers: { Authorization: "Bearer token-123" },
      });

      await client.fleet.listTrucks();

      expect(call.init.headers).toEqual(
        expect.objectContaining({ Authorization: "Bearer token-123" }),
      );
    });

    it("sets Content-Type when body is present", async () => {
      const { fn, call } = createMockFetch({});
      const client = createMiotResourceClient({ baseUrl, organizationId: "org-1", fetch: fn });

      await client.drivers.create({ firstName: "John", lastName: "Doe" });

      expect(call.init.headers).toEqual(
        expect.objectContaining({ "Content-Type": "application/json" }),
      );
    });

    it("does not set Content-Type for GET requests", async () => {
      const { fn, call } = createMockFetch([]);
      const client = createMiotResourceClient({ baseUrl, organizationId: "org-1", fetch: fn });

      await client.fleet.listTrucks();

      const headers = call.init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBeUndefined();
    });
  });

  describe("response handling", () => {
    it("returns parsed JSON for 2xx responses", async () => {
      const mockData = [{ id: 1 }];
      const { fn } = createMockFetch(mockData);
      const client = createMiotResourceClient({ baseUrl, organizationId: "org-1", fetch: fn });

      const result = await client.fleet.listTrucks();

      expect(result).toEqual(mockData);
    });

    it("throws MiotResourceApiError on non-2xx responses", async () => {
      const errorBody: ErrorResponse = {
        error: "Not Found",
        message: "Truck not found",
        status: 404,
        timestamp: "2025-01-01T00:00:00Z",
      };
      const { fn } = createMockFetch(errorBody, 404);
      const client = createMiotResourceClient({ baseUrl, organizationId: "org-1", fetch: fn });

      await expect(client.fleet.getTruck(999)).rejects.toThrow(
        MiotResourceApiError,
      );
    });

    it("includes status and body on MiotResourceApiError", async () => {
      const errorBody: ErrorResponse = {
        error: "Bad Request",
        message: "Invalid input",
        status: 400,
        timestamp: "2025-01-01T00:00:00Z",
      };
      const { fn } = createMockFetch(errorBody, 400);
      const client = createMiotResourceClient({ baseUrl, organizationId: "org-1", fetch: fn });

      try {
        await client.drivers.get(0);
        expect.fail("should have thrown");
      } catch (err) {
        const error = err as MiotResourceApiError;
        expect(error.name).toBe("MiotResourceApiError");
        expect(error.status).toBe(400);
        expect(error.body).toEqual(errorBody);
        expect(error.message).toBe("Invalid input");
      }
    });
  });

  describe("request body serialization", () => {
    it("serializes body as JSON string", async () => {
      const { fn, call } = createMockFetch({});
      const client = createMiotResourceClient({ baseUrl, organizationId: "org-1", fetch: fn });

      const body = { firstName: "John", lastName: "Doe" };
      await client.drivers.create(body);

      expect(call.init.body).toBe(JSON.stringify(body));
    });

    it("does not send body for GET requests", async () => {
      const { fn, call } = createMockFetch([]);
      const client = createMiotResourceClient({ baseUrl, organizationId: "org-1", fetch: fn });

      await client.fleet.listTrucks();

      expect(call.init.body).toBeUndefined();
    });
  });
});
