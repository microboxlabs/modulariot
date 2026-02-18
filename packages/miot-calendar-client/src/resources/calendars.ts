import type { Fetcher } from "../client.js";
import type {
  CalendarRequest,
  CalendarResponse,
  TimeWindowRequest,
  TimeWindowResponse,
} from "../types.js";

const BASE = "/api/v1/miot-calendar/calendars";

export function createCalendarsApi(fetcher: Fetcher) {
  return {
    list(params?: { active?: boolean }): Promise<CalendarResponse[]> {
      return fetcher("GET", BASE, { query: params });
    },

    get(id: string): Promise<CalendarResponse> {
      return fetcher("GET", `${BASE}/${id}`);
    },

    create(body: CalendarRequest): Promise<CalendarResponse> {
      return fetcher("POST", BASE, { body });
    },

    update(id: string, body: CalendarRequest): Promise<CalendarResponse> {
      return fetcher("PUT", `${BASE}/${id}`, { body });
    },

    deactivate(id: string): Promise<void> {
      return fetcher("DELETE", `${BASE}/${id}`);
    },

    listTimeWindows(calendarId: string): Promise<TimeWindowResponse[]> {
      return fetcher("GET", `${BASE}/${calendarId}/time-windows`);
    },

    createTimeWindow(
      calendarId: string,
      body: TimeWindowRequest,
    ): Promise<TimeWindowResponse> {
      return fetcher("POST", `${BASE}/${calendarId}/time-windows`, { body });
    },

    updateTimeWindow(
      calendarId: string,
      timeWindowId: string,
      body: TimeWindowRequest,
    ): Promise<TimeWindowResponse> {
      return fetcher("PUT", `${BASE}/${calendarId}/time-windows/${timeWindowId}`, {
        body,
      });
    },
  };
}
