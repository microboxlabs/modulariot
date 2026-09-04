import { useOptionalPlannerContext, EMPTY_RESULT } from "../../context/planner-context";
import type { PlannerQueryResult } from "../../context/planner-context";

/**
 * Consumer hook to read planner data by variable name.
 * Returns empty result when variableName is undefined, or when rendered
 * outside a PlannerProvider (e.g. a dashlet rendered standalone in chat).
 */
export function usePlannerData(
  variableName?: string
): PlannerQueryResult {
  const { results } = useOptionalPlannerContext();

  if (!variableName) return EMPTY_RESULT;

  return results.get(variableName) ?? EMPTY_RESULT;
}
