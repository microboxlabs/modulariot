import { usePlannerContext, EMPTY_RESULT } from "../../context/planner-context";
import type { PlannerQueryResult } from "../../context/planner-context";

/**
 * Consumer hook to read planner data by variable name.
 * Returns empty result when variableName is undefined.
 */
export function usePlannerData(
  variableName?: string
): PlannerQueryResult {
  const { results } = usePlannerContext();

  if (!variableName) return EMPTY_RESULT;

  return results.get(variableName) ?? EMPTY_RESULT;
}
