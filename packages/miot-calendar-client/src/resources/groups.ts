import type { Fetcher } from "../client.js";
import type { CalendarGroupRequest, CalendarGroupResponse } from "../types.js";

const BASE = "/api/v1/miot-calendar/groups";

export function createGroupsApi(fetcher: Fetcher) {
  return {
    list(params?: { active?: boolean }): Promise<CalendarGroupResponse[]> {
      return fetcher("GET", BASE, { query: params });
    },

    get(id: string): Promise<CalendarGroupResponse> {
      return fetcher("GET", `${BASE}/${id}`);
    },

    create(body: CalendarGroupRequest): Promise<CalendarGroupResponse> {
      return fetcher("POST", BASE, { body });
    },

    update(id: string, body: CalendarGroupRequest): Promise<CalendarGroupResponse> {
      return fetcher("PUT", `${BASE}/${id}`, { body });
    },

    deactivate(id: string): Promise<void> {
      return fetcher("DELETE", `${BASE}/${id}`);
    },
  };
}
