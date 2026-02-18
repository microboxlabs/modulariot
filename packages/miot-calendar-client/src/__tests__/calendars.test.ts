import { describe, it, expect } from "vitest";
import { createMiotCalendarClient } from "../index.js";
import type {
  CalendarRequest,
  CalendarResponse,
  TimeWindowRequest,
  TimeWindowResponse,
} from "../types.js";

function createMockFetch(response: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: url as string, init: init! });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => response,
    } as Response;
  };
  return { fn, calls };
}

const BASE_URL = "https://api.example.com";
const CALENDARS_PATH = "/api/v1/miot-calendar/calendars";

const sampleCalendar: CalendarResponse = {
  id: "cal-1",
  code: "MAIN",
  name: "Main Calendar",
  timezone: "Europe/Madrid",
  active: true,
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
  capacityPerSlot: 5,
  daysOfWeek: "MON,TUE,WED,THU,FRI",
  validFrom: "2025-01-01",
  active: true,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

describe("calendars", () => {
  describe("list", () => {
    it("sends GET to calendars endpoint", async () => {
      const { fn, calls } = createMockFetch([sampleCalendar]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.list();

      expect(calls[0]!.init.method).toBe("GET");
      expect(calls[0]!.url).toBe(`${BASE_URL}${CALENDARS_PATH}`);
    });

    it("passes active filter as query param", async () => {
      const { fn, calls } = createMockFetch([sampleCalendar]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.list({ active: true });

      const url = new URL(calls[0]!.url);
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
      const { fn, calls } = createMockFetch(sampleCalendar);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.get("cal-1");

      expect(calls[0]!.init.method).toBe("GET");
      expect(calls[0]!.url).toBe(`${BASE_URL}${CALENDARS_PATH}/cal-1`);
    });
  });

  describe("create", () => {
    const calendarRequest: CalendarRequest = {
      code: "MAIN",
      name: "Main Calendar",
    };

    it("sends POST with body", async () => {
      const { fn, calls } = createMockFetch(sampleCalendar);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.create(calendarRequest);

      expect(calls[0]!.init.method).toBe("POST");
      expect(calls[0]!.url).toBe(`${BASE_URL}${CALENDARS_PATH}`);
      expect(calls[0]!.init.body).toBe(JSON.stringify(calendarRequest));
    });
  });

  describe("update", () => {
    const calendarRequest: CalendarRequest = {
      code: "MAIN",
      name: "Updated Calendar",
    };

    it("sends PUT to calendars/:id with body", async () => {
      const { fn, calls } = createMockFetch(sampleCalendar);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.update("cal-1", calendarRequest);

      expect(calls[0]!.init.method).toBe("PUT");
      expect(calls[0]!.url).toBe(`${BASE_URL}${CALENDARS_PATH}/cal-1`);
      expect(calls[0]!.init.body).toBe(JSON.stringify(calendarRequest));
    });
  });

  describe("deactivate", () => {
    it("sends DELETE to calendars/:id", async () => {
      const { fn, calls } = createMockFetch(undefined, 204);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.deactivate("cal-1");

      expect(calls[0]!.init.method).toBe("DELETE");
      expect(calls[0]!.url).toBe(`${BASE_URL}${CALENDARS_PATH}/cal-1`);
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
      const { fn, calls } = createMockFetch([sampleTimeWindow]);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.listTimeWindows("cal-1");

      expect(calls[0]!.init.method).toBe("GET");
      expect(calls[0]!.url).toBe(
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
      slotDurationMinutes: 30,
      capacityPerSlot: 5,
      daysOfWeek: "MON,TUE,WED,THU,FRI",
    };

    it("sends POST to calendars/:id/time-windows with body", async () => {
      const { fn, calls } = createMockFetch(sampleTimeWindow);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.createTimeWindow("cal-1", twRequest);

      expect(calls[0]!.init.method).toBe("POST");
      expect(calls[0]!.url).toBe(
        `${BASE_URL}${CALENDARS_PATH}/cal-1/time-windows`,
      );
      expect(calls[0]!.init.body).toBe(JSON.stringify(twRequest));
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
      const { fn, calls } = createMockFetch(sampleTimeWindow);
      const client = createMiotCalendarClient({ baseUrl: BASE_URL, fetch: fn });

      await client.calendars.updateTimeWindow("cal-1", "tw-1", twRequest);

      expect(calls[0]!.init.method).toBe("PUT");
      expect(calls[0]!.url).toBe(
        `${BASE_URL}${CALENDARS_PATH}/cal-1/time-windows/tw-1`,
      );
      expect(calls[0]!.init.body).toBe(JSON.stringify(twRequest));
    });
  });
});
