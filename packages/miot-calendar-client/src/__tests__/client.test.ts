import { describe, it, expect } from "vitest";
import { createMiotCalendarClient, MiotCalendarApiError } from "../index.js";
import type { ErrorResponse } from "../types.js";

function createMockFetch(response: unknown, status = 200) {
  const call = { url: "", init: {} as RequestInit };
  const fn = async (url: string | URL | Request, init: RequestInit = {}) => {
    if (typeof url === "string") {
      call.url = url;
    } else if (url instanceof URL) {
      call.url = url.href;
    } else {
      call.url = url.url;
    }
    call.init = init;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => response,
    } as Response;
  };
  return { fn, call };
}

describe("createMiotCalendarClient", () => {
  const baseUrl = "https://api.example.com";

  describe("URL building", () => {
    it("builds a full URL from baseUrl and path", async () => {
      const { fn, call } = createMockFetch({ data: [], total: 0 });
      const client = createMiotCalendarClient({ baseUrl, fetch: fn });

      await client.bookings.list();

      expect(call.url).toBe(
        "https://api.example.com/api/v1/miot-calendar/bookings",
      );
    });

    it("appends query parameters", async () => {
      const { fn, call } = createMockFetch({ data: [], total: 0 });
      const client = createMiotCalendarClient({ baseUrl, fetch: fn });

      await client.bookings.list({
        calendarId: "cal-1",
        startDate: "2025-01-01",
      });

      const url = new URL(call.url);
      expect(url.searchParams.get("calendarId")).toBe("cal-1");
      expect(url.searchParams.get("startDate")).toBe("2025-01-01");
    });

    it("omits undefined query values", async () => {
      const { fn, call } = createMockFetch({ data: [], total: 0 });
      const client = createMiotCalendarClient({ baseUrl, fetch: fn });

      await client.bookings.list({ calendarId: "cal-1", endDate: undefined });

      const url = new URL(call.url);
      expect(url.searchParams.get("calendarId")).toBe("cal-1");
      expect(url.searchParams.has("endDate")).toBe(false);
    });
  });

  describe("request headers", () => {
    it("sends config-level headers on every request", async () => {
      const { fn, call } = createMockFetch({ data: [], total: 0 });
      const client = createMiotCalendarClient({
        baseUrl,
        fetch: fn,
        headers: { Authorization: "Bearer token-123" },
      });

      await client.bookings.list();

      expect(call.init.headers).toEqual(
        expect.objectContaining({ Authorization: "Bearer token-123" }),
      );
    });

    it("sets Content-Type when body is present", async () => {
      const mockResponse = { id: "cal-1", code: "CAL", name: "Test" };
      const { fn, call } = createMockFetch(mockResponse);
      const client = createMiotCalendarClient({ baseUrl, fetch: fn });

      await client.calendars.create({ code: "CAL", name: "Test" });

      expect(call.init.headers).toEqual(
        expect.objectContaining({ "Content-Type": "application/json" }),
      );
    });

    it("does not set Content-Type for GET requests", async () => {
      const { fn, call } = createMockFetch({ data: [], total: 0 });
      const client = createMiotCalendarClient({ baseUrl, fetch: fn });

      await client.bookings.list();

      const headers = call.init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBeUndefined();
    });
  });

  describe("response handling", () => {
    it("returns parsed JSON for 2xx responses", async () => {
      const mockData = { data: [{ id: "b-1" }], total: 1 };
      const { fn } = createMockFetch(mockData);
      const client = createMiotCalendarClient({ baseUrl, fetch: fn });

      const result = await client.bookings.list();

      expect(result).toEqual(mockData);
    });

    it("returns undefined for 204 No Content", async () => {
      const { fn } = createMockFetch(undefined, 204);
      const client = createMiotCalendarClient({ baseUrl, fetch: fn });

      const result = await client.bookings.cancel("b-1");

      expect(result).toBeUndefined();
    });

    it("throws MiotCalendarApiError on non-2xx responses", async () => {
      const errorBody: ErrorResponse = {
        error: "Not Found",
        message: "Booking not found",
        status: 404,
        timestamp: "2025-01-01T00:00:00Z",
      };
      const { fn } = createMockFetch(errorBody, 404);
      const client = createMiotCalendarClient({ baseUrl, fetch: fn });

      await expect(client.bookings.get("missing")).rejects.toThrow(
        MiotCalendarApiError,
      );
    });

    it("includes status and body on MiotCalendarApiError", async () => {
      const errorBody: ErrorResponse = {
        error: "Bad Request",
        message: "Invalid input",
        status: 400,
        timestamp: "2025-01-01T00:00:00Z",
      };
      const { fn } = createMockFetch(errorBody, 400);
      const client = createMiotCalendarClient({ baseUrl, fetch: fn });

      try {
        await client.calendars.get("bad-id");
        expect.fail("should have thrown");
      } catch (err) {
        const error = err as MiotCalendarApiError;
        expect(error.name).toBe("MiotCalendarApiError");
        expect(error.status).toBe(400);
        expect(error.body).toEqual(errorBody);
        expect(error.message).toBe("Invalid input");
      }
    });
  });

  describe("request body serialization", () => {
    it("serializes body as JSON string", async () => {
      const mockResponse = { id: "cal-1", code: "CAL", name: "Test" };
      const { fn, call } = createMockFetch(mockResponse);
      const client = createMiotCalendarClient({ baseUrl, fetch: fn });

      const body = { code: "CAL", name: "Test" };
      await client.calendars.create(body);

      expect(call.init.body).toBe(JSON.stringify(body));
    });

    it("does not send body for GET requests", async () => {
      const { fn, call } = createMockFetch({ data: [], total: 0 });
      const client = createMiotCalendarClient({ baseUrl, fetch: fn });

      await client.bookings.list();

      expect(call.init.body).toBeUndefined();
    });
  });
});
