import { describe, it, expect } from "vitest";
import { createMiotCalendarClient } from "../index.js";
import type {
  GenerateSlotsRequest,
  GenerateSlotsResponse,
  SlotResponse,
  SlotListResponse,
  UpdateSlotStatusRequest,
} from "../types.js";
import { createMockFetch } from "./test-utils.js";

const BASE_URL = "https://api.example.com";
const SLOTS_PATH = "/api/v1/miot-calendar/slots";

const sampleSlot: SlotResponse = {
  id: "s-1",
  calendarId: "cal-1",
  timeWindowId: "tw-1",
  slotDate: "2025-06-01",
  slotHour: 10,
  slotMinutes: 0,
  capacity: 5,
  currentOccupancy: 2,
  availableCapacity: 3,
  status: "OPEN",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

describe("slots", () => {
  describe("list", () => {
    const listResponse: SlotListResponse = {
      data: [sampleSlot],
      total: 1,
    };

    it("sends GET with required calendarId", async () => {
      const { fn, call } = createMockFetch(listResponse);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.slots.list({ calendarId: "cal-1" });

      expect(call.init.method).toBe("GET");
      const url = new URL(call.url);
      expect(url.pathname).toBe(SLOTS_PATH);
      expect(url.searchParams.get("calendarId")).toBe("cal-1");
    });

    it("passes optional filter params", async () => {
      const { fn, call } = createMockFetch(listResponse);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.slots.list({
        calendarId: "cal-1",
        available: true,
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      });

      const url = new URL(call.url);
      expect(url.searchParams.get("available")).toBe("true");
      expect(url.searchParams.get("startDate")).toBe("2025-01-01");
      expect(url.searchParams.get("endDate")).toBe("2025-12-31");
    });

    it("returns the slot list response", async () => {
      const { fn } = createMockFetch(listResponse);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.slots.list({ calendarId: "cal-1" });

      expect(result).toEqual(listResponse);
    });
  });

  describe("get", () => {
    it("sends GET to slots/:id", async () => {
      const { fn, call } = createMockFetch(sampleSlot);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.slots.get("s-1");

      expect(call.init.method).toBe("GET");
      expect(call.url).toBe(`${BASE_URL}${SLOTS_PATH}/s-1`);
    });

    it("returns the slot", async () => {
      const { fn } = createMockFetch(sampleSlot);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.slots.get("s-1");

      expect(result).toEqual(sampleSlot);
    });
  });

  describe("generate", () => {
    const generateRequest: GenerateSlotsRequest = {
      calendarId: "cal-1",
      startDate: "2025-06-01",
      endDate: "2025-06-30",
    };

    const generateResponse: GenerateSlotsResponse = {
      slotsCreated: 100,
      slotsSkipped: 5,
      message: "Slots generated successfully",
    };

    it("sends POST to slots/generate with body", async () => {
      const { fn, call } = createMockFetch(generateResponse);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.slots.generate(generateRequest);

      expect(call.init.method).toBe("POST");
      expect(call.url).toBe(`${BASE_URL}${SLOTS_PATH}/generate`);
      expect(call.init.body).toBe(JSON.stringify(generateRequest));
    });

    it("returns the generation result", async () => {
      const { fn } = createMockFetch(generateResponse);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.slots.generate(generateRequest);

      expect(result).toEqual(generateResponse);
    });
  });

  describe("updateStatus", () => {
    const statusRequest: UpdateSlotStatusRequest = { status: "CLOSED" };

    it("sends PATCH to slots/:id/status with body", async () => {
      const { fn, call } = createMockFetch(sampleSlot);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.slots.updateStatus("s-1", statusRequest);

      expect(call.init.method).toBe("PATCH");
      expect(call.url).toBe(`${BASE_URL}${SLOTS_PATH}/s-1/status`);
      expect(call.init.body).toBe(JSON.stringify(statusRequest));
    });

    it("returns the updated slot", async () => {
      const { fn } = createMockFetch({ ...sampleSlot, status: "CLOSED" });
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.slots.updateStatus("s-1", statusRequest);

      expect(result.status).toBe("CLOSED");
    });
  });
});
