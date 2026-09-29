import process from "node:process";
import { createRemotePlanOperationExecutor } from "@microboxlabs/miot-dashboard-server/queries";

function flag(name) {
  const value = process.env[name];
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  throw new Error(`Invalid boolean configuration: ${name}`);
}

/** Opt-in standalone adapter for the existing ModularIoT catalog. No Java query execution. */
export function createDashboardOperations() {
  const url = process.env.MIOT_DASHBOARD_PLAN_URL;
  const proxyKey = process.env.MIOT_DASHBOARD_PROXY_KEY;
  if (!url || !proxyKey)
    throw new Error("Dashboard plan URL and service key are required");
  return createRemotePlanOperationExecutor({
    url,
    proxyKey,
    allowHttp: flag("MIOT_DASHBOARD_PLAN_ALLOW_HTTP"),
    allowedDataOrigins: (process.env.MIOT_DASHBOARD_DATA_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    allowDataHttp: flag("MIOT_DASHBOARD_DATA_ALLOW_HTTP"),
  });
}
