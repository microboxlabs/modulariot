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
  color: z.string().optional(),
  kind: z.enum(["WINDOW", "BLOCK"]).optional(),
  slotGenerationMode: z.enum(["AUTO", "MANUAL"]).optional(),
  // Lower bound only; the window-length upper bound is enforced server-side.
  slotDurationMinutes: z.number().int().min(5).optional(),
});
