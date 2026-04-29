import { describe, expect, it } from "vitest";
import {
  createMiotConnectionClient,
  MiotConnectionApiError,
} from "../index.js";
import type { ErrorResponse } from "../types.js";
import { createMockFetch } from "./test-utils.js";

describe("createMiotConnectionClient", () => {
  const baseUrl = "https://api.example.com";
  const organizationId = "org-1";

  describe("URL building", () => {
    it("builds a full URL from baseUrl and path", async () => {
      const { fn, call } = createMockFetch([]);
      const client = createMiotConnectionClient({
        baseUrl,
        organizationId,
        fetch: fn,
      });

      await client.connections.list();

      expect(call.url).toBe(
        "https://api.example.com/api/v1/orgs/org-1/integrations/connections",
      );
    });
  });

  describe("request headers", () => {
    it("sends config-level headers on every request", async () => {
      const { fn, call } = createMockFetch([]);
      const client = createMiotConnectionClient({
        baseUrl,
        organizationId,
        fetch: fn,
        headers: { Authorization: "Bearer token-123" },
      });

      await client.connections.list();

      expect(call.init.headers).toEqual(
        expect.objectContaining({ Authorization: "Bearer token-123" }),
      );
    });

    it("sets Content-Type when body is present", async () => {
      const { fn, call } = createMockFetch({});
      const client = createMiotConnectionClient({
        baseUrl,
        organizationId,
        fetch: fn,
      });

      await client.connections.create({
        name: "PostgREST",
        providerType: "POSTGREST",
        baseUrl: "https://postgrest.example.com",
        credentialProfileId: "profile-1",
      });

      expect(call.init.headers).toEqual(
        expect.objectContaining({ "Content-Type": "application/json" }),
      );
    });

    it("does not set Content-Type for GET requests", async () => {
      const { fn, call } = createMockFetch([]);
      const client = createMiotConnectionClient({
        baseUrl,
        organizationId,
        fetch: fn,
      });

      await client.connections.list();

      const headers = call.init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBeUndefined();
    });
  });

  describe("response handling", () => {
    it("returns parsed JSON for 2xx responses", async () => {
      const mockData = [{ id: "conn-1" }];
      const { fn } = createMockFetch(mockData);
      const client = createMiotConnectionClient({
        baseUrl,
        organizationId,
        fetch: fn,
      });

      const result = await client.connections.list();

      expect(result).toEqual(mockData);
    });

    it("throws MiotConnectionApiError on non-2xx responses", async () => {
      const errorBody: ErrorResponse = {
        error: "Not Found",
        message: "Connection not found",
        status: 404,
        timestamp: "2026-01-01T00:00:00Z",
      };
      const { fn } = createMockFetch(errorBody, 404);
      const client = createMiotConnectionClient({
        baseUrl,
        organizationId,
        fetch: fn,
      });

      await expect(client.connections.get("missing")).rejects.toThrow(
        MiotConnectionApiError,
      );
    });

    it("includes status and body on MiotConnectionApiError", async () => {
      const errorBody: ErrorResponse = {
        error: "Bad Request",
        message: "Invalid input",
        status: 400,
        timestamp: "2026-01-01T00:00:00Z",
      };
      const { fn } = createMockFetch(errorBody, 400);
      const client = createMiotConnectionClient({
        baseUrl,
        organizationId,
        fetch: fn,
      });

      try {
        await client.connections.get("bad-id");
        expect.fail("should have thrown");
      } catch (err) {
        const error = err as MiotConnectionApiError;
        expect(error.name).toBe("MiotConnectionApiError");
        expect(error.status).toBe(400);
        expect(error.body).toEqual(errorBody);
        expect(error.message).toBe("Invalid input");
      }
    });
  });

  describe("request body serialization", () => {
    it("serializes body as JSON string", async () => {
      const { fn, call } = createMockFetch({});
      const client = createMiotConnectionClient({
        baseUrl,
        organizationId,
        fetch: fn,
      });

      const body = {
        displayName: "Bearer credentials",
        authType: "BEARER_TOKEN" as const,
        secretConfig: { token: "token-123" },
      };
      await client.credentialProfiles.create(body);

      expect(call.init.body).toBe(JSON.stringify(body));
    });

    it("does not send body for GET requests", async () => {
      const { fn, call } = createMockFetch([]);
      const client = createMiotConnectionClient({
        baseUrl,
        organizationId,
        fetch: fn,
      });

      await client.connections.list();

      expect(call.init.body).toBeUndefined();
    });
  });
});
