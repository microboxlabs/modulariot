import { z } from "zod";
import { refreshIntervalSchema } from "@microboxlabs/miot-dashboard-contract/schema";
import type { RefreshInterval } from "@microboxlabs/miot-dashboard-contract/document";
export interface DashboardGeneralSettingsValue {
  name: string;
  refreshInterval: RefreshInterval;
  order?: number;
}
export const generalSettingsSchema = z
  .object({
    name: z.string().trim().min(1).max(256),
    refreshInterval: refreshIntervalSchema,
    order: z.number().finite().optional(),
  })
  .strict();
