import type {
  DashboardQueryDefinition,
  DashboardStorageSchema,
} from "@microboxlabs/miot-dashboard-contract/document";
import { validateDashboardConfig } from "@microboxlabs/miot-dashboard-contract/schema";
import { plannerParameterBindings } from "./planner-contracts";

/** Operator-reviewed catalog references and bindings for one legacy request. */
export interface PlannerQueryMapping {
  plannerId: string;
  connectionId: string;
  operationId: string;
  /** Derived from the legacy request's parameters when omitted. */
  parameters?: DashboardQueryDefinition["parameters"];
}

export interface PlannerMigrationOptions {
  /**
   * Label for the date filter the legacy page showed without declaring it.
   * It is declared when a binding reads `date_range_from` or `date_range_to`.
   */
  dateFilterLabel?: string;
}

export type PlannerMigrationResult =
  | { ok: true; config: DashboardStorageSchema }
  | { ok: false; problems: readonly string[] };

/**
 * Convert a complete planner using explicit mappings. No network or store writes.
 * The operator must verify catalog authorization, parameter types and tenant
 * isolation separately. Opaque widget settings are preserved, not certified.
 */
export function migratePlannerQueries(
  input: unknown,
  mappings: readonly PlannerQueryMapping[],
  options: PlannerMigrationOptions = {},
): PlannerMigrationResult {
  const parsed = validateDashboardConfig(input);
  if (!parsed.valid) return { ok: false, problems: parsed.problems };
  const config = parsed.config;
  const planner = config.requestPlanner ?? [];
  if (planner.length === 0)
    return { ok: false, problems: ["No legacy planner requests to migrate"] };
  if (config.queries?.length)
    return {
      ok: false,
      problems: ["Existing saved queries must be reconciled before migration"],
    };

  const ids = new Set(planner.map((request) => request.id));
  const variables = new Set(planner.map((request) => request.variableName));
  if (ids.size !== planner.length || variables.size !== planner.length)
    return {
      ok: false,
      problems: [
        "Legacy planner identifiers and variable names must be unique",
      ],
    };
  const byId = new Map(mappings.map((mapping) => [mapping.plannerId, mapping]));
  if (byId.size !== mappings.length)
    return { ok: false, problems: ["Duplicate planner mappings"] };
  if (byId.size !== ids.size || [...byId.keys()].some((id) => !ids.has(id)))
    return {
      ok: false,
      problems: ["Every legacy request needs exactly one explicit mapping"],
    };

  const problems: string[] = [];
  const queries = planner.map((request): DashboardQueryDefinition => {
    const mapping = byId.get(request.id)!;
    let parameters = mapping.parameters;
    if (parameters === undefined) {
      const derived = plannerParameterBindings(request);
      if (derived.ok) parameters = derived.parameters;
      else problems.push(...derived.problems);
    }
    return {
      id: request.id,
      variableName: request.variableName,
      connectionId: mapping.connectionId,
      operationId: mapping.operationId,
      parameters: parameters ?? {},
      ...(request.schema === undefined ? {} : { schema: request.schema }),
    };
  });
  if (problems.length) return { ok: false, problems };
  const converted = {
    ...config,
    queries,
    filters: withDateFilter(config.filters, queries, options.dateFilterLabel),
  };
  if (converted.filters === undefined) delete converted.filters;
  delete converted.requestPlanner;
  const validated = validateDashboardConfig(converted);
  return validated.valid
    ? { ok: true, config: validated.config }
    : { ok: false, problems: validated.problems };
}

const DATE_KEYS = new Set(["date_range_from", "date_range_to"]);

function withDateFilter(
  filters: DashboardStorageSchema["filters"],
  queries: readonly DashboardQueryDefinition[],
  label = "Date",
): DashboardStorageSchema["filters"] {
  if (filters?.some((filter) => filter.type === "date_range")) return filters;
  const usesDate = queries.some((query) =>
    Object.values(query.parameters).some(
      (binding) => binding.kind === "filter" && DATE_KEYS.has(binding.key),
    ),
  );
  if (!usesDate) return filters;
  return [...(filters ?? []), { key: "date_range", label, type: "date_range" }];
}
