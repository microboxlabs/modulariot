/** Which symptoms the Control Tower shows, by whether they go to the operators. */
export type OperatorFilter = "required" | "none" | "all";

/** The filter's URL parameter, and its parameter in the symptom APIs. */
export const OPERATOR_PARAM = "operator";

/** localStorage key of the user's last choice. */
export const OPERATOR_FILTER_KEY = "miot.control-tower.operator-filter";

export const DEFAULT_OPERATOR_FILTER: OperatorFilter = "required";

/** The filter a raw value names, or undefined when it names none. */
export function parseOperatorFilter(
  raw: string | null | undefined
): OperatorFilter | undefined {
  const value = raw?.trim();
  return value === "required" || value === "none" || value === "all"
    ? value
    : undefined;
}
