import { describe, it, expect } from "vitest";
import { createMiotCalendarClient } from "../index.js";
import type {
  BookingRequest,
  BookingResponse,
  BookingListResponse,
  BookingUpdateRequest,
} from "../types.js";
import { createMockFetch } from "./test-utils.js";

const BASE_URL = "https://api.example.com";
const BOOKINGS_PATH = "/api/v1/miot-calendar/bookings";

const sampleBooking: BookingResponse = {
  id: "b-1",
  calendarId: "cal-1",
  resource: { id: "r-1", type: "room", label: "Room A" },
  slot: { date: "2025-06-01", hour: 10, minutes: 0 },
  createdAt: "2025-01-01T00:00:00Z",
};

describe("bookings", () => {
  describe("list", () => {
    const listResponse: BookingListResponse = {
      data: [sampleBooking],
      total: 1,
    };

    it("sends GET to bookings endpoint", async () => {
      const { fn, call } = createMockFetch(listResponse);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.bookings.list();

      expect(call.init.method).toBe("GET");
      expect(call.url).toBe(`${BASE_URL}${BOOKINGS_PATH}`);
    });

    it("passes query parameters", async () => {
      const { fn, call } = createMockFetch(listResponse);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.bookings.list({
        calendarId: "cal-1",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      });

      const url = new URL(call.url);
      expect(url.searchParams.get("calendarId")).toBe("cal-1");
      expect(url.searchParams.get("startDate")).toBe("2025-01-01");
      expect(url.searchParams.get("endDate")).toBe("2025-12-31");
    });

    it("returns the booking list response", async () => {
      const { fn } = createMockFetch(listResponse);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.bookings.list();

      expect(result).toEqual(listResponse);
    });
  });

  describe("get", () => {
    it("sends GET to bookings/:id", async () => {
      const { fn, call } = createMockFetch(sampleBooking);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.bookings.get("b-1");

      expect(call.init.method).toBe("GET");
      expect(call.url).toBe(`${BASE_URL}${BOOKINGS_PATH}/b-1`);
    });

    it("returns the booking", async () => {
      const { fn } = createMockFetch(sampleBooking);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.bookings.get("b-1");

      expect(result).toEqual(sampleBooking);
    });
  });

  describe("create", () => {
    const bookingRequest: BookingRequest = {
      calendarId: "cal-1",
      resource: { id: "r-1", type: "room", label: "Room A" },
      slot: { date: "2025-06-01", hour: 10, minutes: 0 },
    };

    it("sends POST with body", async () => {
      const { fn, call } = createMockFetch(sampleBooking);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.bookings.create(bookingRequest);

      expect(call.init.method).toBe("POST");
      expect(call.url).toBe(`${BASE_URL}${BOOKINGS_PATH}`);
      expect(call.init.body).toBe(JSON.stringify(bookingRequest));
    });

    it("sends X-User-Id header when userId is provided", async () => {
      const { fn, call } = createMockFetch(sampleBooking);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.bookings.create(bookingRequest, { userId: "user-42" });

      const headers = call.init.headers as Record<string, string>;
      expect(headers["X-User-Id"]).toBe("user-42");
    });

    it("forwards excludeBookingId in the request body when set", async () => {
      const { fn, call } = createMockFetch(sampleBooking);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const reassignRequest: BookingRequest = {
        ...bookingRequest,
        excludeBookingId: "old-booking-id",
      };
      await client.bookings.create(reassignRequest);

      expect(call.init.body).toBe(JSON.stringify(reassignRequest));
    });

    it("does not send X-User-Id when userId is not provided", async () => {
      const { fn, call } = createMockFetch(sampleBooking);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.bookings.create(bookingRequest);

      const headers = call.init.headers as Record<string, string>;
      expect(headers["X-User-Id"]).toBeUndefined();
    });
  });

  describe("update", () => {
    const updateRequest: BookingUpdateRequest = {
      resource: {
        id: "r-1",
        type: "room",
        label: "Room A (assigned)",
        data: { assignedCarrier: "c-1" },
      },
    };

    it("sends PUT to bookings/:id with body", async () => {
      const { fn, call } = createMockFetch(sampleBooking);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.bookings.update("b-1", updateRequest);

      expect(call.init.method).toBe("PUT");
      expect(call.url).toBe(`${BASE_URL}${BOOKINGS_PATH}/b-1`);
      expect(call.init.body).toBe(JSON.stringify(updateRequest));
    });

    it("returns the updated booking", async () => {
      const { fn } = createMockFetch(sampleBooking);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.bookings.update("b-1", updateRequest);

      expect(result).toEqual(sampleBooking);
    });
  });

  describe("cancel", () => {
    it("sends DELETE to bookings/:id", async () => {
      const { fn, call } = createMockFetch(undefined, 204);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.bookings.cancel("b-1");

      expect(call.init.method).toBe("DELETE");
      expect(call.url).toBe(`${BASE_URL}${BOOKINGS_PATH}/b-1`);
    });

    it("returns undefined", async () => {
      const { fn } = createMockFetch(undefined, 204);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.bookings.cancel("b-1");

      expect(result).toBeUndefined();
    });
  });

  describe("listByResource", () => {
    const listResponse: BookingListResponse = {
      data: [sampleBooking],
      total: 1,
    };

    it("sends GET to bookings/resource/:resourceId", async () => {
      const { fn, call } = createMockFetch(listResponse);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.bookings.listByResource("r-1");

      expect(call.init.method).toBe("GET");
      expect(call.url).toBe(`${BASE_URL}${BOOKINGS_PATH}/resource/r-1`);
    });

    it("returns the booking list", async () => {
      const { fn } = createMockFetch(listResponse);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.bookings.listByResource("r-1");

      expect(result).toEqual(listResponse);
    });
  });
});
