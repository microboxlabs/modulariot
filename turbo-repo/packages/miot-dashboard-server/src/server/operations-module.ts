import { isAbsolute, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { createHttpDashboardOperationExecutor } from "../queries/http-operations";
import type { DashboardOperationExecutor } from "../seams/operations";
import type { DashboardQueryCatalog } from "../seams/query-catalog";
import type { ServerConfig } from "./config";

export function isOperationsModulePath(path: string): boolean {
  return isAbsolute(path) && [".mjs", ".js", ".cjs"].includes(extname(path));
}

/** Operator-installed code, loaded at startup only; never selected by a request. */
export async function loadConfiguredOperations(
  config: Pick<ServerConfig, "operations" | "operationsModule">,
): Promise<(DashboardOperationExecutor & { queryCatalog?: DashboardQueryCatalog }) | undefined> {
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
    if (module.createDashboardQueryCatalog === undefined) return operations;
    if (typeof module.createDashboardQueryCatalog !== "function")
      throw new Error("Invalid catalog module factory");
    const catalog: unknown = await module.createDashboardQueryCatalog();
    if (!catalog || typeof catalog !== "object" || !("list" in catalog) || typeof catalog.list !== "function")
      throw new Error("Invalid query catalog provider");
    return {
      execute: (request) => operations.execute(request),
      queryCatalog: catalog as DashboardQueryCatalog,
    };
  } catch {
    // A host's import/factory failure may contain credentials. Never forward it.
    throw new Error("Dashboard operation module could not be initialized");
  }
}
