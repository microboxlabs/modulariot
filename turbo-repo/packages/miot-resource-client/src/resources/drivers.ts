import type { Fetcher } from "../client.js";
import type {
  BulkSyncRequest,
  BulkSyncResponse,
  CreateDriverRequest,
  Driver,
  EntityEvent,
  PageParams,
  StatusChangeRequest,
  UpdateDriverRequest,
} from "../types.js";

const BASE = "/api/v1/drivers";

export function createDriversApi(fetcher: Fetcher) {
  return {
    list(params?: PageParams): Promise<Driver[]> {
      return fetcher("GET", BASE, { query: params });
    },

    get(id: number): Promise<Driver> {
      return fetcher("GET", `${BASE}/${id}`);
    },

    create(body: CreateDriverRequest): Promise<Driver> {
      return fetcher("POST", BASE, { body });
    },

    update(id: number, body: UpdateDriverRequest): Promise<Driver> {
      return fetcher("PUT", `${BASE}/${id}`, { body });
    },

    changeStatus(id: number, body: StatusChangeRequest): Promise<Driver> {
      return fetcher("PATCH", `${BASE}/${id}/status`, { body });
    },

    listEvents(id: number, params?: { limit?: number }): Promise<EntityEvent[]> {
      return fetcher("GET", `${BASE}/${id}/events`, { query: params });
    },

    bulkSync(body: BulkSyncRequest): Promise<BulkSyncResponse> {
      return fetcher("POST", `${BASE}/bulk-sync`, { body });
    },
  };
}
