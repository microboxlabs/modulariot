"use client";

import { useMemo } from "react";
import { useRuntimeConfig } from "@/features/runtime-config/runtime-config-context";
import { parseTaskDrivenOrigins } from "./task-driven-origin";

/**
 * Bridge between the backend `RuntimeConfigProvider` and the pure
 * `decide*`/`isOriginTaskDriven` helpers. Reads the comma-separated
 * `TASK_DRIVEN_ORIGINS` runtime value, parses it once per change, and
 * returns a memoized `ReadonlySet<string>` callers pass into the helpers.
 *
 * Returns the empty set while the runtime-config fetch is in flight —
 * the default flag-off path is the legacy behavior, so no action a user
 * can take during that window mis-fires.
 */
export function useTaskDrivenOrigins(): ReadonlySet<string> {
  const config = useRuntimeConfig();
  return useMemo(
    () => parseTaskDrivenOrigins(config?.TASK_DRIVEN_ORIGINS),
    [config?.TASK_DRIVEN_ORIGINS]
  );
}
