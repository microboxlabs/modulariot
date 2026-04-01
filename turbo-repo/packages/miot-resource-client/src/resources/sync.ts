import type { Fetcher } from "../client.js";
import type { AdvanceCursorRequest, SyncCursor } from "../types.js";

const BASE = "/api/v1/sync/cursor";

export function createSyncApi(fetcher: Fetcher) {
  return {
    getCursor(sourceSystem: string, entityType: string): Promise<SyncCursor> {
      return fetcher("GET", `${BASE}/${sourceSystem}/${entityType}`);
    },

    advanceCursor(
      sourceSystem: string,
      entityType: string,
      body: AdvanceCursorRequest,
    ): Promise<SyncCursor> {
      return fetcher("PUT", `${BASE}/${sourceSystem}/${entityType}`, { body });
    },
  };
}
