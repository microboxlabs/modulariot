import type { Fetcher } from "../client.js";
import type {
  SlotManagerRequest,
  SlotManagerResponse,
  SlotManagerRunResponse,
} from "../types.js";

const BASE = "/api/v1/miot-calendar/slot-managers";

export function createSlotManagersApi(fetcher: Fetcher) {
  return {
    list(params?: { active?: boolean }): Promise<SlotManagerResponse[]> {
      return fetcher("GET", BASE, { query: params });
    },

    create(body: SlotManagerRequest): Promise<SlotManagerResponse> {
      return fetcher("POST", BASE, { body });
    },

    get(id: string): Promise<SlotManagerResponse> {
      return fetcher("GET", `${BASE}/${id}`);
    },

    update(
      id: string,
      body: SlotManagerRequest,
    ): Promise<SlotManagerResponse> {
      return fetcher("PUT", `${BASE}/${id}`, { body });
    },

    deactivate(id: string): Promise<void> {
      return fetcher("DELETE", `${BASE}/${id}`);
    },

    runAll(): Promise<SlotManagerRunResponse[]> {
      return fetcher("POST", `${BASE}/run`);
    },

    run(id: string): Promise<SlotManagerRunResponse> {
      return fetcher("POST", `${BASE}/${id}/run`);
    },

    listAllRuns(params?: {
      limit?: number;
    }): Promise<SlotManagerRunResponse[]> {
      return fetcher("GET", `${BASE}/runs`, { query: params });
    },

    listRuns(
      id: string,
      params?: { limit?: number },
    ): Promise<SlotManagerRunResponse[]> {
      return fetcher("GET", `${BASE}/${id}/runs`, { query: params });
    },
  };
}
