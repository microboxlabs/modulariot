import type { DashboardCatalogConnection } from "../seams/query-catalog";

function text(value: string, limit: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > limit)
    throw new TypeError("Invalid query catalog metadata");
  return value;
}
function unique(ids: string[]) {
  if (new Set(ids).size !== ids.length)
    throw new TypeError("Duplicate catalog identifier");
}
/** Copy only public fields, even if a host mistakenly returns an administrative record. */
export function projectQueryCatalog(
  catalog: DashboardCatalogConnection[],
): DashboardCatalogConnection[] {
  if (!Array.isArray(catalog) || catalog.length > 100)
    throw new TypeError("Invalid query catalog size");
  let bytes = 0;
  function boundedText(value: string, limit: number) {
    const valid = text(value, limit);
    bytes += new TextEncoder().encode(valid).byteLength;
    if (bytes > 262144) throw new TypeError("Query catalog is too large");
    return valid;
  }
  const result = catalog.map((connection) => {
    if (
      !Array.isArray(connection.operations) ||
      connection.operations.length > 100
    )
      throw new TypeError("Invalid catalog operations");
    const operations = connection.operations.map((operation) => {
      const projected = {
        id: boundedText(operation.id, 128),
        label: boundedText(operation.label, 256),
      };
      if (operation.schema === undefined) return projected;
      if (!Array.isArray(operation.schema) || operation.schema.length > 100)
        throw new TypeError("Invalid catalog columns");
      return {
        ...projected,
        schema: operation.schema.map((column) => boundedText(column, 128)),
      };
    });
    unique(operations.map((operation) => operation.id));
    return {
      id: boundedText(connection.id, 128),
      label: boundedText(connection.label, 256),
      operations,
    };
  });
  unique(result.map((connection) => connection.id));
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 262144)
    throw new TypeError("Query catalog is too large");
  return result;
}
