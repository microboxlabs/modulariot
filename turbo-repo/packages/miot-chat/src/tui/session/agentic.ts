import type { RunMode } from "@microboxlabs/miot-harness-client";

export const AGENTIC_TENANT_LOCK = "mintral";

export function isAgenticTenantMismatch(
  mode: RunMode,
  tenant: string,
): boolean {
  return mode === "agentic" && tenant !== AGENTIC_TENANT_LOCK;
}
