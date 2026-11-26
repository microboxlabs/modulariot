/**
 * Rules that compare parts of a dashboard document with each other and with
 * a query catalog. A document can match the contract and still show nothing;
 * these rules find the cases this package can prove.
 */

import type { DashboardQueryCatalogResponse } from "./catalog";
import type {
  DashboardFilterParam,
  DashboardStorageSchema,
  Widget,
} from "./document";
import { dashboardConfigSchema } from "./schema";

export type DashboardProblemSeverity = "error" | "warning";

/** One problem. Plain data, so a caller is not tied to this package's zod. */
export interface DashboardProblem {
  rule: string;
  /** Dotted from the document root, as in `validateDashboardConfig`. */
  path: string;
  message: string;
  severity: DashboardProblemSeverity;
}

/** Every rule and its severity. `contract` is the zod validation. */
export const DASHBOARD_LINT_RULES = Object.freeze({
  contract: "error",
  "filter-key-unique": "error",
  "query-id-unique": "error",
  "filter-binding": "error",
  "date-range-binding": "error",
  "widget-query": "error",
  "operation-exists": "error",
  "filter-unused": "warning",
  "column-exists": "warning",
} as const satisfies Record<string, DashboardProblemSeverity>);

export type DashboardLintRule = keyof typeof DASHBOARD_LINT_RULES;

export interface DashboardLintResult {
  /** False when any problem has severity `error`. */
  valid: boolean;
  problems: DashboardProblem[];
}

/**
 * The names a filter delivers to query bindings. `text` and `select` deliver
 * their key; `date_range` delivers `<key>_from` and `<key>_to`, never `<key>`.
 */
export function deliveredFilterNames(
  filter: Pick<DashboardFilterParam, "key" | "type">,
): string[] {
  return filter.type === "date_range"
    ? [`${filter.key}_from`, `${filter.key}_to`]
    : [filter.key];
}

function problem(
  rule: DashboardLintRule,
  path: string,
  message: string,
): DashboardProblem {
  return { rule, path, message, severity: DASHBOARD_LINT_RULES[rule] };
}

function quoted(names: Iterable<string>): string {
  const list = [...names].map((name) => `"${name}"`);
  return list.length > 0 ? list.join(", ") : "none";
}

/** Bound repeated hints even when legacy filter keys are arbitrarily long. */
function deliveredNamesHint(names: ReadonlySet<string>): string {
  const preview: string[] = [];
  for (const name of names) {
    if (preview.length === 10) break;
    preview.push(name.length > 128 ? `${name.slice(0, 128)}…` : name);
  }
  const omitted = names.size - preview.length;
  return quoted(preview) + (omitted > 0 ? `, … (${omitted} more)` : "");
}

/** A widget config as an object: stored as one, or as a JSON string of one. */
function readConfig(value: unknown): Record<string, unknown> | null {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

interface WidgetAt {
  widget: Widget;
  path: string;
  config: Record<string, unknown> | null;
}

function* walkWidgets(widgets: readonly Widget[], prefix: string): Generator<WidgetAt> {
  for (const [index, widget] of widgets.entries()) {
    const path = `${prefix}.${index}`;
    yield { widget, path, config: readConfig(widget.config) };
    if (widget.children) yield* walkWidgets(widget.children, `${path}.children`);
  }
}

function plannerVariable(config: Record<string, unknown> | null) {
  if (config?.dataMode !== "planner") return undefined;
  const name = config.plannerVariableName;
  return { name: typeof name === "string" ? name : "" };
}

/** `{{filter.x}}` and `{{#if filter.x}}` in legacy planner parameter values. */
function templateFilterNames(value: string): string[] {
  const names: string[] = [];
  for (const block of value.matchAll(/\{\{([^}]*)\}\}/g)) {
    for (const match of (block[1] ?? "").matchAll(/(?:^|[^\w.])filter\.([\w-]+)/g)) {
      names.push(match[1]!);
    }
  }
  return names;
}

function duplicates(
  values: readonly string[],
  rule: "filter-key-unique" | "query-id-unique",
  pathOf: (index: number) => string,
  describe: (value: string, first: number) => string,
): DashboardProblem[] {
  const first = new Map<string, number>();
  const found: DashboardProblem[] = [];
  values.forEach((value, index) => {
    const earlier = first.get(value);
    if (earlier === undefined) first.set(value, index);
    else found.push(problem(rule, pathOf(index), describe(value, earlier)));
  });
  return found;
}

function bindingProblems(config: DashboardStorageSchema): DashboardProblem[] {
  const filters = config.filters ?? [];
  const delivered = new Set(filters.flatMap(deliveredFilterNames));
  const deliveredHint = deliveredNamesHint(delivered);
  const dateRangeKeys = new Set(
    filters.filter((filter) => filter.type === "date_range").map((filter) => filter.key),
  );
  const found: DashboardProblem[] = [];
  (config.queries ?? []).forEach((query, index) => {
    for (const [name, binding] of Object.entries(query.parameters)) {
      if (binding.kind !== "filter" || delivered.has(binding.key)) continue;
      const path = `queries.${index}.parameters.${name}.key`;
      if (dateRangeKeys.has(binding.key)) {
        found.push(
          problem(
            "date-range-binding",
            path,
            `Parameter "${name}" of query "${query.id}" is bound to "${binding.key}", which is a date_range filter. A date_range filter delivers "${binding.key}_from" and "${binding.key}_to"; bind to one of those.`,
          ),
        );
      } else {
        found.push(
          problem(
            "filter-binding",
            path,
            `Parameter "${name}" of query "${query.id}" is bound to filter "${binding.key}", which no filter delivers. Delivered names: ${deliveredHint}.`,
          ),
        );
      }
    }
  });
  return found;
}

function unusedFilterProblems(config: DashboardStorageSchema): DashboardProblem[] {
  const read = new Set<string>();
  for (const query of config.queries ?? []) {
    for (const binding of Object.values(query.parameters)) {
      if (binding.kind === "filter") read.add(binding.key);
    }
  }
  for (const request of config.requestPlanner ?? []) {
    for (const parameter of request.pgrestParams) {
      for (const name of templateFilterNames(parameter.value)) read.add(name);
    }
  }
  const found: DashboardProblem[] = [];
  (config.filters ?? []).forEach((filter, index) => {
    const names = deliveredFilterNames(filter);
    // A binding to the bare key of a date_range filter is already a date-range-binding error.
    if (read.has(filter.key) || names.some((name) => read.has(name))) return;
    found.push(
      problem(
        "filter-unused",
        `filters.${index}`,
        `Filter "${filter.key}" delivers ${quoted(names)}, and no query reads any of them.`,
      ),
    );
  });
  return found;
}

function widgetQueryProblems(config: DashboardStorageSchema): DashboardProblem[] {
  const variables = new Set([
    ...(config.queries ?? []).map((query) => query.variableName),
    ...(config.requestPlanner ?? []).map((request) => request.variableName),
  ]);
  const found: DashboardProblem[] = [];
  for (const { widget, path, config: widgetConfig } of walkWidgets(config.widgets, "widgets")) {
    const variable = plannerVariable(widgetConfig);
    if (!variable || (variable.name !== "" && variables.has(variable.name))) continue;
    found.push(
      problem(
        "widget-query",
        `${path}.config.plannerVariableName`,
        variable.name === ""
          ? `Widget "${widget.id}" reads query data but names no query. Query variables: ${quoted(variables)}.`
          : `Widget "${widget.id}" reads query "${variable.name}", which no query defines. Query variables: ${quoted(variables)}.`,
      ),
    );
  }
  return found;
}

function operationProblems(
  config: DashboardStorageSchema,
  catalog: DashboardQueryCatalogResponse,
): DashboardProblem[] {
  const found: DashboardProblem[] = [];
  (config.queries ?? []).forEach((query, index) => {
    const connection = catalog.connections.find((item) => item.id === query.connectionId);
    if (!connection) {
      found.push(
        problem(
          "operation-exists",
          `queries.${index}.connectionId`,
          `Query "${query.id}" uses connection "${query.connectionId}", which is not in the catalog.`,
        ),
      );
    } else if (!connection.operations.some((operation) => operation.id === query.operationId)) {
      found.push(
        problem(
          "operation-exists",
          `queries.${index}.operationId`,
          `Query "${query.id}" uses operation "${query.operationId}", which connection "${query.connectionId}" does not offer.`,
        ),
      );
    }
  });
  return found;
}

/**
 * The config fields that name result columns, by component. Tables are left
 * out: their column keys are templates, so a key need not be a column.
 */
function columnReferences(
  componentId: string,
  config: Record<string, unknown>,
): { path: string; column: string }[] {
  const listField = componentId === "chart" ? "series" : componentId === "chart_v2" ? "representations" : undefined;
  if (!listField) return [];
  const references: { path: string; column: string }[] = [];
  if (typeof config.xAxisColumn === "string" && config.xAxisColumn !== "") {
    references.push({ path: "xAxisColumn", column: config.xAxisColumn });
  }
  const list = config[listField];
  if (Array.isArray(list)) {
    list.forEach((item, index) => {
      const column = readConfig(item)?.columnKey;
      if (typeof column === "string" && column !== "") {
        references.push({ path: `${listField}.${index}.columnKey`, column });
      }
    });
  }
  return references;
}

function columnProblems(
  config: DashboardStorageSchema,
  catalog: DashboardQueryCatalogResponse,
): DashboardProblem[] {
  const plannerNames = new Set((config.requestPlanner ?? []).map((request) => request.variableName));
  const found: DashboardProblem[] = [];
  for (const { widget, path, config: widgetConfig } of walkWidgets(config.widgets, "widgets")) {
    const variable = plannerVariable(widgetConfig);
    if (!variable || !widgetConfig || plannerNames.has(variable.name)) continue;
    const queries = (config.queries ?? []).filter((query) => query.variableName === variable.name);
    // Two queries with one variable name: which result the widget gets is not certain.
    if (queries.length !== 1) continue;
    const query = queries[0]!;
    const schema = catalog.connections
      .find((connection) => connection.id === query.connectionId)
      ?.operations.find((operation) => operation.id === query.operationId)?.schema;
    if (!schema) continue;
    const columns = new Set(schema);
    for (const reference of columnReferences(widget.componentId, widgetConfig)) {
      if (columns.has(reference.column)) continue;
      found.push(
        problem(
          "column-exists",
          `${path}.config.${reference.path}`,
          `Widget "${widget.id}" uses column "${reference.column}", which operation "${query.connectionId}/${query.operationId}" does not return. Columns: ${quoted(schema)}.`,
        ),
      );
    }
  }
  return found;
}

/**
 * Validate a document against the contract, then apply the lint rules. When
 * the contract check fails, only its problems are returned. Rules that need a
 * catalog run only when one is passed.
 */
export function lintDashboardConfig(
  input: unknown,
  catalog?: DashboardQueryCatalogResponse,
): DashboardLintResult {
  const parsed = dashboardConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      problems: parsed.error.issues.map((issue) =>
        problem("contract", issue.path.join("."), issue.message),
      ),
    };
  }
  const config = parsed.data as DashboardStorageSchema;
  const problems = [
    ...duplicates(
      (config.filters ?? []).map((filter) => filter.key),
      "filter-key-unique",
      (index) => `filters.${index}.key`,
      (key, first) => `Filter key "${key}" is already used by filters.${first}.`,
    ),
    ...duplicates(
      (config.queries ?? []).map((query) => query.id),
      "query-id-unique",
      (index) => `queries.${index}.id`,
      (id, first) => `Query id "${id}" is already used by queries.${first}.`,
    ),
    ...bindingProblems(config),
    ...widgetQueryProblems(config),
    ...(catalog ? operationProblems(config, catalog) : []),
    ...unusedFilterProblems(config),
    ...(catalog ? columnProblems(config, catalog) : []),
  ];
  return {
    valid: !problems.some((item) => item.severity === "error"),
    problems,
  };
}
