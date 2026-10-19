import { buildDataProviderContext } from "./engine";

/** Static templates use one object, or the first object in an array of rows. */
export function parseTemplateRow(
  json?: string,
): Record<string, unknown> | undefined {
  if (!json) return undefined;
  try {
    const parsed: unknown = JSON.parse(json);
    const row: unknown = Array.isArray(parsed) ? parsed[0] : parsed;
    if (row && typeof row === "object" && !Array.isArray(row)) {
      return row as Record<string, unknown>;
    }
  } catch {
    // Invalid static data is absent; never log dashboard contents.
  }
  return undefined;
}

/** Reserved namespaces cannot be replaced by fields in a query/static row. */
export function createTemplateContext({
  row,
  filters,
  dataProvider,
}: {
  row?: Readonly<Record<string, unknown>>;
  filters: Readonly<Record<string, string>>;
  dataProvider?: readonly { key: string; value: string }[];
}): Record<string, unknown> {
  return {
    ...row,
    ...(row ? { row } : {}),
    ...(dataProvider ? buildDataProviderContext(dataProvider) : {}),
    filter: filters,
  };
}

/** Uses the host's isolated engine; output keys are ordinary own properties. */
export function resolveTemplateFields(
  fields: Readonly<Record<string, string>>,
  context: Record<string, unknown>,
  engine: {
    resolveField(template: string, context: Record<string, unknown>): string;
  },
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, template]) => [
      key,
      engine.resolveField(template, context),
    ]),
  );
}
