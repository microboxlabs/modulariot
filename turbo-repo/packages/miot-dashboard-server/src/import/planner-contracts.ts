import type {
  DashboardQueryDefinition,
  PlannerRequestDefinition,
} from "@microboxlabs/miot-dashboard-contract/document";
import { validateDashboardConfig } from "@microboxlabs/miot-dashboard-contract/schema";

const FILTER_TEMPLATE = /^\{\{\s*filter\.([A-Za-z0-9_]+)\s*\}\}$/;
const MAX_TEXT = 2048;

/**
 * A read-only HTTP GET operation contract for one legacy PostgREST path. An
 * integrations admin creates it on the connection that replaces
 * `dataSourceId`; its schema is what the host enforces on every call.
 */
export interface PlannerOperationContract {
  dataSourceId?: string;
  name: string;
  method: "GET";
  path: string;
  requestSchema: Record<string, unknown>;
  /** Legacy requests (`slug/requestId`) served by this operation. */
  usedBy: string[];
}

export interface PlannerContractOptions {
  /**
   * Parameters whose single literal value is pinned with `const`, e.g. a
   * client identifier. A pinned parameter must carry the same literal in
   * every request that uses the path.
   */
  pinnedParameters?: readonly string[];
}

type ContractResult =
  | { ok: true; contracts: PlannerOperationContract[] }
  | { ok: false; problems: string[] };

/** One contract per (data source, path), covering every parameter any request passes. */
export function plannerOperationContracts(
  dashboards: Readonly<Record<string, unknown>>,
  options: PlannerContractOptions = {},
): ContractResult {
  const pinned = new Set(options.pinnedParameters ?? []);
  const problems: string[] = [];
  const groups = new Map<
    string,
    {
      dataSourceId?: string;
      path: string;
      usedBy: string[];
      values: Map<string, Set<string>>;
    }
  >();
  for (const [slug, input] of Object.entries(dashboards)) {
    const parsed = validateDashboardConfig(input);
    if (!parsed.valid) {
      problems.push(`${slug}: ${parsed.problems.join("; ")}`);
      continue;
    }
    for (const request of parsed.config.requestPlanner ?? []) {
      const where = `${slug}/${request.id}`;
      if (request.pgrestHttpMethod !== "GET") {
        problems.push(`${where}: only GET requests can become HTTP_GET operations`);
        continue;
      }
      const path = operationPath(request.pgrestFunctionName);
      if (!path) {
        problems.push(`${where}: unsupported path "${request.pgrestFunctionName}"`);
        continue;
      }
      const key = `${request.dataSourceId ?? ""}\u0000${path}`;
      const group = groups.get(key) ?? {
        dataSourceId: request.dataSourceId,
        path,
        usedBy: [],
        values: new Map<string, Set<string>>(),
      };
      groups.set(key, group);
      group.usedBy.push(where);
      for (const { key: name, value } of request.pgrestParams) {
        const values = group.values.get(name) ?? new Set<string>();
        values.add(value);
        group.values.set(name, values);
      }
    }
  }
  const contracts = [...groups.values()].map((group) => {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [name, values] of group.values) {
      if (!pinned.has(name)) {
        properties[name] = { type: "string", maxLength: MAX_TEXT };
        continue;
      }
      const literals = [...values];
      if (literals.length !== 1 || literals[0] === "" || literals[0]!.includes("{{")) {
        problems.push(
          `${group.path}: pinned parameter ${name} needs one literal value, found ${literals.length}`,
        );
        continue;
      }
      properties[name] = { type: "string", const: literals[0] };
      required.push(name);
    }
    return {
      ...(group.dataSourceId === undefined ? {} : { dataSourceId: group.dataSourceId }),
      name: group.path.slice(group.path.lastIndexOf("/") + 1),
      method: "GET" as const,
      path: group.path,
      requestSchema: {
        type: "object",
        additionalProperties: false,
        properties,
        ...(required.length ? { required: required.sort() } : {}),
        "x-dashboard": { readOnly: true, kind: "HTTP_GET", credentialScoped: true },
      },
      usedBy: group.usedBy,
    };
  });
  return problems.length
    ? { ok: false, problems }
    : { ok: true, contracts: contracts.sort((a, b) => a.path.localeCompare(b.path)) };
}

type BindingResult =
  | { ok: true; parameters: DashboardQueryDefinition["parameters"] }
  | { ok: false; problems: string[] };

/**
 * `{{filter.key}}` becomes an optional filter binding and any other value a
 * literal, matching the legacy planner, which dropped blank values.
 */
export function plannerParameterBindings(
  request: PlannerRequestDefinition,
): BindingResult {
  const parameters: DashboardQueryDefinition["parameters"] = {};
  const problems: string[] = [];
  for (const { key, value } of request.pgrestParams) {
    if (value === "") continue;
    const filter = FILTER_TEMPLATE.exec(value);
    if (filter) {
      parameters[key] = { kind: "filter", key: filter[1]!, omitWhenEmpty: true };
    } else if (value.includes("{{")) {
      problems.push(`${request.id}: parameter ${key} uses an unsupported template`);
    } else {
      parameters[key] = { kind: "literal", value };
    }
  }
  return problems.length ? { ok: false, problems } : { ok: true, parameters };
}

function operationPath(functionName: string): string | null {
  const trimmed = functionName.trim().replace(/^\/+/, "");
  return /^[A-Za-z0-9_]+(\/[A-Za-z0-9_]+)?$/.test(trimmed) ? `/${trimmed}` : null;
}
