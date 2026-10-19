import { z } from "zod";
import { createTemplateEngine, type CompiledTemplate } from "./engine";

const index = z.number().int().nonnegative();
const point = z.union([
  z.array(z.unknown()),
  z.object({ rowIndex: index.optional(), value: z.unknown().optional() }),
  z.number(),
  z.string(),
  z.null(),
]);
const paramsSchema = z.object({
  dataIndex: index.optional(),
  data: point.optional(),
});

/** Compile once; returns plain text for a chart engine's non-HTML tooltip mode. */
export function createChartTooltipFormatter(
  template: string,
  rows: readonly Record<string, string>[],
  engine = createTemplateEngine(),
): (params: unknown) => string {
  let compiled: CompiledTemplate;
  try {
    compiled = engine.compileTextTemplate(template);
  } catch {
    compiled = () => template;
  }
  return (params) => {
    const result = paramsSchema.safeParse(params);
    if (!result.success) return "";
    const { data, dataIndex } = result.data;
    const object =
      data !== null && typeof data === "object" && !Array.isArray(data)
        ? data
        : undefined;
    let values = Array.isArray(data) ? data : undefined;
    if (object && Array.isArray(object.value)) values = object.value;
    const explicitIndex = object?.rowIndex;
    const candidate = explicitIndex ?? values?.[2] ?? dataIndex;
    const parsedIndex = index.safeParse(candidate);
    if (!parsedIndex.success) return "";
    const row = rows[parsedIndex.data];
    if (!row) return "";
    try {
      return compiled({ ...row, row });
    } catch {
      return template;
    }
  };
}
