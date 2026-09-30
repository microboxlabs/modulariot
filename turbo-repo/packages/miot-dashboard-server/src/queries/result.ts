import { dashboardQueryValueSchema } from "@microboxlabs/miot-dashboard-contract/schema";
import { DashboardServerError } from "../access/errors";
import type { DashboardQueryResult } from "../seams/operations";

export function upstreamError(): DashboardServerError {
  return new DashboardServerError(
    "UPSTREAM_ERROR",
    "Dashboard query could not be completed",
  );
}

export function validateResult(
  result: unknown,
  maxRows: number,
  maxBytes: number,
) {
  if (
    typeof result !== "object" ||
    result === null ||
    !("rows" in result) ||
    !Array.isArray(result.rows) ||
    result.rows.length > maxRows
  )
    throw upstreamError();
  for (const row of result.rows) {
    if (typeof row !== "object" || row === null || Array.isArray(row))
      throw upstreamError();
    const values = Object.values(row);
    if (
      values.length > 100 ||
      values.some(
        (value) => !dashboardQueryValueSchema.safeParse(value).success,
      )
    )
      throw upstreamError();
  }
  const safe = { rows: result.rows };
  if (new TextEncoder().encode(JSON.stringify(safe)).byteLength > maxBytes)
    throw upstreamError();
  return safe as DashboardQueryResult;
}
