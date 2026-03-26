import type { Fetcher } from "../client.js";
import type {
  GenerateSlotsRequest,
  GenerateSlotsResponse,
  SlotListResponse,
  SlotResponse,
  UpdateSlotStatusRequest,
} from "../types.js";

const BASE = "/api/v1/miot-calendar/slots";

export function createSlotsApi(fetcher: Fetcher) {
  return {
    list(params: {
      calendarId: string;
      available?: boolean;
      startDate?: string;
      endDate?: string;
    }): Promise<SlotListResponse> {
      return fetcher("GET", BASE, { query: params });
    },

    get(id: string): Promise<SlotResponse> {
      return fetcher("GET", `${BASE}/${id}`);
    },

    generate(body: GenerateSlotsRequest): Promise<GenerateSlotsResponse> {
      return fetcher("POST", `${BASE}/generate`, { body });
    },

    updateStatus(
      id: string,
      body: UpdateSlotStatusRequest,
    ): Promise<SlotResponse> {
      return fetcher("PATCH", `${BASE}/${id}/status`, { body });
    },
  };
}
