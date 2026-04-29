import { createMiotCalendarClient } from "@microboxlabs/miot-calendar-client";
import { createMiotConnectionClient } from "@microboxlabs/miot-connection-client";
import type { ResolvedConfig } from "./config.js";

export type MiotClient = ReturnType<typeof createMiotCalendarClient> &
  ReturnType<typeof createMiotConnectionClient>;

export function createClient(config: ResolvedConfig): MiotClient {
  const clientConfig = {
    baseUrl: config.baseUrl,
    headers: { Authorization: `Bearer ${config.token}` },
  };

  return {
    ...createMiotCalendarClient(clientConfig),
    ...createMiotConnectionClient({
      ...clientConfig,
      organizationId: config.organizationId ?? "",
    }),
  };
}
