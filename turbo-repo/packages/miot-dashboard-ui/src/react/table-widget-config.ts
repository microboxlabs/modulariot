import { z } from "zod";
const operator = z.enum([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "greater_than",
  "less_than",
  "greater_than_or_equal",
  "less_than_or_equal",
]);
const rule = z.object({ operator, value: z.string(), color: z.string() });
export const tableWidgetConfig = z.object({
  title: z.string().default(""),
  dataMode: z.string().default("static"),
  plannerVariableName: z.string().optional(),
  columns: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        type: z.string().default("text"),
        sticky: z.boolean().optional(),
        dataType: z
          .enum(["text", "number", "date", "enum", "boolean"])
          .optional(),
        decorator: z.string().optional(),
        colorRulesEnabled: z.boolean().optional(),
        colorMap: z.array(rule).optional(),
        descriptionEnabled: z.boolean().optional(),
        description: z.string().optional(),
      }),
    )
    .default([]),
  rows: z.array(z.record(z.string())).default([]),
  filter: z
    .object({
      enabled: z.boolean(),
      items: z.array(z.object({ column: z.string(), label: z.string() })),
    })
    .default({ enabled: false, items: [] }),
  sort: z
    .object({ enabled: z.boolean(), columns: z.array(z.string()) })
    .default({ enabled: false, columns: [] }),
  showRowCount: z.boolean().default(true),
  showColumnDividers: z.boolean().default(true),
  rowColorRules: z
    .object({
      enabled: z.boolean(),
      rules: z.array(rule.extend({ column: z.string() })),
    })
    .optional(),
  actions: z.unknown().optional(),
});
