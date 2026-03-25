import { z } from "zod";

export const TimeWindowRequestSchema = z.object({
  name: z.string(),
  startHour: z.number(),
  endHour: z.number(),
  validFrom: z.string(),
  capacity: z.number().optional(),
  daysOfWeek: z.string().optional(),
  validTo: z.string().optional(),
  active: z.boolean().optional(),
});
