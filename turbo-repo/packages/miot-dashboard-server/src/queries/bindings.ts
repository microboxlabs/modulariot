import type {
  DashboardQueryDefinition,
  DashboardQueryValue,
} from "@microboxlabs/miot-dashboard-contract/document";
import {
  dashboardQueryValueSchema,
  validateDashboardConfig,
} from "@microboxlabs/miot-dashboard-contract/schema";
import { DashboardServerError } from "../access/errors";

export function savedQuery(
  config: unknown,
  queryId: string,
): DashboardQueryDefinition {
  const parsed = validateDashboardConfig(config);
  if (!parsed.valid)
    throw new DashboardServerError(
      "INTERNAL_ERROR",
      "Invalid stored dashboard",
    );
  const matches =
    parsed.config.queries?.filter((query) => query.id === queryId) ?? [];
  if (matches.length === 0)
    throw DashboardServerError.notFound("Dashboard query not found");
  if (matches.length !== 1)
    throw DashboardServerError.badRequest("Ambiguous dashboard query");
  return matches[0]!;
}

export function bindParameters(
  query: DashboardQueryDefinition,
  filters: unknown,
) {
  if (
    typeof filters !== "object" ||
    filters === null ||
    Array.isArray(filters)
  ) {
    throw DashboardServerError.badRequest("Filters must be an object");
  }
  const entries = Object.entries(filters);
  const parameters = Object.entries(query.parameters);
  if (entries.length > 32 || parameters.length > 100) {
    throw DashboardServerError.badRequest("Too many query parameters");
  }
  const allowed = new Set(
    parameters.flatMap(([, binding]) =>
      binding.kind === "filter" ? [binding.key] : [],
    ),
  );
  const values = new Map<string, DashboardQueryValue>();
  for (const [key, value] of entries) {
    const parsed = dashboardQueryValueSchema.safeParse(value);
    if (!allowed.has(key) || !parsed.success) {
      throw DashboardServerError.badRequest("Invalid dashboard filter");
    }
    values.set(key, parsed.data);
  }
  return Object.fromEntries(
    parameters.map(([name, binding]) => {
      if (binding.kind === "literal") return [name, binding.value];
      const value = values.has(binding.key)
        ? values.get(binding.key)
        : binding.defaultValue;
      if (value === undefined)
        throw DashboardServerError.badRequest(
          "Required dashboard filter is missing",
        );
      return [name, value];
    }),
  ) as Record<string, DashboardQueryValue>;
}
