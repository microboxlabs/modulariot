import { createMiotCalendarClient } from "@microboxlabs/miot-calendar-client";
import type { ResolvedConfig } from "./config.js";

export type MiotClient = ReturnType<typeof createMiotCalendarClient>;

export function createClient(config: ResolvedConfig): MiotClient {
  return createMiotCalendarClient({
    baseUrl: config.baseUrl,
    headers: { Authorization: `Bearer ${config.token}` },
  });
}
