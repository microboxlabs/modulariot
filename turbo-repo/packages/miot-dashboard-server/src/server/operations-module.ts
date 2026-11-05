import { isAbsolute, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { createHttpDashboardOperationExecutor } from "../queries/http-operations";
import type { DashboardOperationExecutor } from "../seams/operations";
import type { DashboardQueryCatalog } from "../seams/query-catalog";
import type { QueryAuthoring } from "../seams/authoring";
import type { ServerConfig } from "./config";

export function isOperationsModulePath(path: string): boolean {
  return isAbsolute(path) && [".mjs", ".js", ".cjs"].includes(extname(path));
}

/** Operator-installed code, loaded at startup only; never selected by a request. */
export async function loadConfiguredOperations(
  config: Pick<ServerConfig, "operations" | "operationsModule">,
): Promise<
  | (DashboardOperationExecutor & {
      queryCatalog?: DashboardQueryCatalog;
      queryAuthoring?: QueryAuthoring;
    })
  | undefined
> {
  if (!config.operationsModule) {
    return config.operations
      ? createHttpDashboardOperationExecutor(config.operations)
      : undefined;
  }
  try {
    if (config.operations || !isOperationsModulePath(config.operationsModule))
      throw new Error("Invalid operation module configuration");
    const module = await import(
      /* @vite-ignore */ pathToFileURL(config.operationsModule).href
    );
    if (typeof module.createDashboardOperations !== "function")
      throw new Error("Missing operation module factory");
    const executor: unknown = await module.createDashboardOperations();
    if (
      !executor ||
      typeof executor !== "object" ||
      !("execute" in executor) ||
      typeof executor.execute !== "function"
    )
      throw new Error("Invalid operation executor");
    const operations = executor as DashboardOperationExecutor;
    // null from either factory: the module supports it but this deployment does not configure it.
    const catalog = await optionalProvider(module.createDashboardQueryCatalog, [
      "list",
    ]);
    const authoring = await optionalProvider(
      module.createDashboardQueryAuthoring,
      ["listSources", "accessFor", "plans"],
    );
    return {
      execute: (request) => operations.execute(request),
      ...(catalog ? { queryCatalog: catalog as DashboardQueryCatalog } : {}),
      ...(authoring ? { queryAuthoring: authoring as QueryAuthoring } : {}),
    };
  } catch {
    // A host's import/factory failure may contain credentials. Never forward it.
    throw new Error("Dashboard operation module could not be initialized");
  }
}

async function optionalProvider(
  factory: unknown,
  members: readonly string[],
): Promise<object | null> {
  if (factory === undefined) return null;
  if (typeof factory !== "function") throw new Error("Invalid module factory");
  const provider: unknown = await factory();
  if (provider === null) return null;
  if (
    !provider ||
    typeof provider !== "object" ||
    members.some((member) => {
      const value = (provider as Record<string, unknown>)[member];
      return member === "plans"
        ? typeof value !== "object" || value === null
        : typeof value !== "function";
    })
  )
    throw new Error("Invalid module provider");
  return provider;
}
