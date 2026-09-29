import { isAbsolute, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { createHttpDashboardOperationExecutor } from "../queries/http-operations";
import type { DashboardOperationExecutor } from "../seams/operations";
import type { ServerConfig } from "./config";

export function isOperationsModulePath(path: string): boolean {
  return isAbsolute(path) && [".mjs", ".js", ".cjs"].includes(extname(path));
}

/** Operator-installed code, loaded at startup only; never selected by a request. */
export async function loadConfiguredOperations(
  config: Pick<ServerConfig, "operations" | "operationsModule">,
): Promise<DashboardOperationExecutor | undefined> {
  if (!config.operationsModule) {
    return config.operations
      ? createHttpDashboardOperationExecutor(config.operations)
      : undefined;
  }
  try {
    if (config.operations || !isOperationsModulePath(config.operationsModule))
      throw new Error();
    const module = await import(
      /* @vite-ignore */ pathToFileURL(config.operationsModule).href
    );
    if (typeof module.createDashboardOperations !== "function")
      throw new Error();
    const executor: unknown = await module.createDashboardOperations();
    if (
      !executor ||
      typeof executor !== "object" ||
      !("execute" in executor) ||
      typeof executor.execute !== "function"
    )
      throw new Error();
    return executor as DashboardOperationExecutor;
  } catch {
    // A host's import/factory failure may contain credentials. Never forward it.
    throw new Error("Dashboard operation module could not be initialized");
  }
}
