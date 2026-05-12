import { describe, it, expect } from "vitest";
import { createMiotCalendarClient } from "../index.js";
import type {
  CalendarRequest,
  CalendarResponse,
  TimeWindowRequest,
  TimeWindowResponse,
} from "../types.js";
import { createMockFetch } from "./test-utils.js";

const BASE_URL = "https://api.example.com";
const CALENDARS_PATH = "/api/v1/miot-calendar/calendars";

const sampleCalendar: CalendarResponse = {
  id: "cal-1",
  code: "MAIN",
  name: "Main Calendar",
  timezone: "Europe/Madrid",
  active: true,
  parallelism: 1,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

const sampleTimeWindow: TimeWindowResponse = {
  id: "tw-1",
  calendarId: "cal-1",
  name: "Morning",
  startHour: 8,
  endHour: 12,
  slotDurationMinutes: 30,
  capacity: 5,
  daysOfWeek: "MON,TUE,WED,THU,FRI",
  validFrom: "2025-01-01",
  active: true,
  kind: "WINDOW",
  slotGenerationMode: "MANUAL",
  totalSlots: 8,
  bookableSlots: 5,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

describe("calendars", () => {
  describe("list", () => {
    it("sends GET to calendars endpoint", async () => {
      const { fn, call } = createMockFetch([sampleCalendar]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.list();

      expect(call.init.method).toBe("GET");
      expect(call.url).toBe(`${BASE_URL}${CALENDARS_PATH}`);
    });

    it("passes active filter as query param", async () => {
      const { fn, call } = createMockFetch([sampleCalendar]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.list({ active: true });

      const url = new URL(call.url);
      expect(url.searchParams.get("active")).toBe("true");
    });

    it("returns calendar array", async () => {
      const { fn } = createMockFetch([sampleCalendar]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.calendars.list();

      expect(result).toEqual([sampleCalendar]);
    });
  });

  describe("get", () => {
    it("sends GET to calendars/:id", async () => {
      const { fn, call } = createMockFetch(sampleCalendar);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.get("cal-1");

      expect(call.init.method).toBe("GET");
      expect(call.url).toBe(`${BASE_URL}${CALENDARS_PATH}/cal-1`);
    });
  });

  describe("create", () => {
    const calendarRequest: CalendarRequest = {
      code: "MAIN",
      name: "Main Calendar",
    };

    it("sends POST with body", async () => {
      const { fn, call } = createMockFetch(sampleCalendar);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.create(calendarRequest);

      expect(call.init.method).toBe("POST");
      expect(call.url).toBe(`${BASE_URL}${CALENDARS_PATH}`);
      expect(call.init.body).toBe(JSON.stringify(calendarRequest));
    });
  });

  describe("update", () => {
    const calendarRequest: CalendarRequest = {
      code: "MAIN",
      name: "Updated Calendar",
    };

    it("sends PUT to calendars/:id with body", async () => {
      const { fn, call } = createMockFetch(sampleCalendar);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.update("cal-1", calendarRequest);

      expect(call.init.method).toBe("PUT");
      expect(call.url).toBe(`${BASE_URL}${CALENDARS_PATH}/cal-1`);
      expect(call.init.body).toBe(JSON.stringify(calendarRequest));
    });
  });

  describe("purge", () => {
    it("sends DELETE to calendars/:id/purge", async () => {
      const { fn, call } = createMockFetch(undefined, 204);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.purge("cal-1");

      expect(call.init.method).toBe("DELETE");
      expect(call.url).toBe(`${BASE_URL}${CALENDARS_PATH}/cal-1/purge`);
    });

    it("returns undefined", async () => {
      const { fn } = createMockFetch(undefined, 204);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.calendars.purge("cal-1");

      expect(result).toBeUndefined();
    });
  });

  describe("deactivate", () => {
    it("sends DELETE to calendars/:id", async () => {
      const { fn, call } = createMockFetch(undefined, 204);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.deactivate("cal-1");

      expect(call.init.method).toBe("DELETE");
      expect(call.url).toBe(`${BASE_URL}${CALENDARS_PATH}/cal-1`);
    });

    it("returns undefined", async () => {
      const { fn } = createMockFetch(undefined, 204);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.calendars.deactivate("cal-1");

      expect(result).toBeUndefined();
    });
  });

  describe("listTimeWindows", () => {
    it("sends GET to calendars/:id/time-windows", async () => {
      const { fn, call } = createMockFetch([sampleTimeWindow]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.listTimeWindows("cal-1");

      expect(call.init.method).toBe("GET");
      expect(call.url).toBe(
        `${BASE_URL}${CALENDARS_PATH}/cal-1/time-windows`,
      );
    });
  });

  describe("createTimeWindow", () => {
    const twRequest: TimeWindowRequest = {
      name: "Morning",
      startHour: 8,
      endHour: 12,
      validFrom: "2025-01-01",
      capacity: 5,
      daysOfWeek: "MON,TUE,WED,THU,FRI",
    };

    it("sends POST to calendars/:id/time-windows with body", async () => {
      const { fn, call } = createMockFetch(sampleTimeWindow);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.createTimeWindow("cal-1", twRequest);

      expect(call.init.method).toBe("POST");
      expect(call.url).toBe(
        `${BASE_URL}${CALENDARS_PATH}/cal-1/time-windows`,
      );
      expect(call.init.body).toBe(JSON.stringify(twRequest));
    });

    it("forwards kind=BLOCK and surfaces it on the response", async () => {
      const blockRequest: TimeWindowRequest = {
        name: "Maintenance",
        startHour: 10,
        endHour: 12,
        validFrom: "2025-01-01",
        kind: "BLOCK",
      };
      const blockResponse: TimeWindowResponse = {
        ...sampleTimeWindow,
        capacity: 0,
        kind: "BLOCK",
        totalSlots: 0,
        bookableSlots: 0,
      };
      const { fn, call } = createMockFetch(blockResponse);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      const result = await client.calendars.createTimeWindow("cal-1", blockRequest);

      expect(call.init.body).toBe(JSON.stringify(blockRequest));
      expect(result.kind).toBe("BLOCK");
      expect(result.capacity).toBe(0);
    });
  });

  describe("updateTimeWindow", () => {
    const twRequest: TimeWindowRequest = {
      name: "Updated Morning",
      startHour: 9,
      endHour: 13,
      validFrom: "2025-01-01",
    };

    it("sends PUT to calendars/:calendarId/time-windows/:timeWindowId", async () => {
      const { fn, call } = createMockFetch(sampleTimeWindow);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.updateTimeWindow("cal-1", "tw-1", twRequest);

      expect(call.init.method).toBe("PUT");
      expect(call.url).toBe(
        `${BASE_URL}${CALENDARS_PATH}/cal-1/time-windows/tw-1`,
      );
      expect(call.init.body).toBe(JSON.stringify(twRequest));
    });
  });
});
