import type { PgrestParam, PgrestHttpMethod } from "./pgrest-types";
import { usePgrestRows } from "./use-pgrest-rows";
import { usePlannerData } from "./use-planner-data";

interface DashletDataConfig {
  dataMode: string;
  pgrestFunctionName: string;
  pgrestHttpMethod: PgrestHttpMethod;
  pgrestParams: PgrestParam[];
  dataSourceId?: string;
  plannerVariableName?: string;
}

interface DashletDataResult {
  rows: Record<string, string>[];
  loading: boolean;
  fetchError: string | null;
}

/**
 * Unified data hook for table/list dashlets.
 * Routes between usePgrestRows and usePlannerData based on dataMode.
 * Both hooks are always called (hooks rules) but only the active one provides data.
 */
export function useDashletData(config: DashletDataConfig): DashletDataResult {
  const {
    dataMode,
    pgrestFunctionName,
    pgrestHttpMethod,
    pgrestParams,
    dataSourceId,
    plannerVariableName,
  } = config;

  // Always call both hooks (hooks rules)
  const pgrest = usePgrestRows(
    dataMode === "pgrest" ? "pgrest" : "static", // only activate when pgrest mode
    pgrestFunctionName,
    pgrestHttpMethod,
    pgrestParams,
    dataSourceId
  );

  const planner = usePlannerData(
    dataMode === "planner" ? plannerVariableName : undefined
  );

  if (dataMode === "planner") {
    return {
      rows: planner.rows,
      loading: planner.loading,
      fetchError: planner.error,
    };
  }

  return pgrest;
}
