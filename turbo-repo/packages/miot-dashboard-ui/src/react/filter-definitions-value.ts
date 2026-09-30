import { z } from "zod";
import { dashboardFilterParamSchema } from "@microboxlabs/miot-dashboard-contract/schema";
const key = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_-]{0,127}$/)
  .refine(
    (value) => !["__proto__", "constructor", "prototype"].includes(value),
  );
const option = z
  .object({
    label: z.string().trim().min(1).max(256),
    value: z.string().min(1).max(1024),
  })
  .passthrough();
export const filterDefinitionsSchema = dashboardFilterParamSchema
  .extend({
    key,
    label: z.string().trim().min(1).max(256),
    options: z.array(option).max(500).optional(),
  })
  .array()
  .max(100)
  .superRefine((filters, context) => {
    const keys = new Set<string>();
    for (const [index, filter] of filters.entries()) {
      const effective =
        filter.type === "date_range"
          ? [filter.key, `${filter.key}_from`, `${filter.key}_to`]
          : [filter.key];
      if (effective.some((value) => keys.has(value)))
        context.addIssue({
          code: "custom",
          path: [index, "key"],
          message: "Overlapping filter keys",
        });
      for (const value of effective) keys.add(value);
      if (
        filter.options &&
        new Set(filter.options.map((item) => item.value)).size !==
          filter.options.length
      )
        context.addIssue({
          code: "custom",
          path: [index, "options"],
          message: "Duplicate option values",
        });
    }
  });
