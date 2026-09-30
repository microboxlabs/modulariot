export {
  isGreaterOperator,
  isLessOperator,
  sortColorRules,
  sortColorRulesWithFields,
  getCompareValue,
  evaluateColorRulesGeneric,
  evaluateColorRulesWithFields,
  type SortableRule,
  type ColorableRule,
  type EvaluatableRule,
  type ComparableRule,
  type EvaluatedColors,
} from "@microboxlabs/miot-dashboard-ui/core";

// ============================================================================
// Style builder helpers
// ============================================================================

/** Convert hex color to rgba string */
export function hexToRgba(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Build text style from rule color or manual color */
export function buildTextStyle(
  ruleColor: string | undefined,
  manualColor: string | undefined
): React.CSSProperties | undefined {
  if (ruleColor) return { color: `#${ruleColor}` };
  if (manualColor) return { color: `#${manualColor}` };
  return undefined;
}

/** Build background style from rule color or manual setting */
export function buildBgStyle(
  ruleColor: string | undefined,
  showManualColor: boolean,
  manualColor: string,
  opacity = "CC"
): React.CSSProperties | undefined {
  if (ruleColor) return { backgroundColor: `#${ruleColor}${opacity}` };
  if (showManualColor) return { backgroundColor: `#${manualColor}${opacity}` };
  return undefined;
}

/** Build icon style with background tint and text color */
export function buildIconStyle(
  ruleColor: string | undefined,
  manualColor: string
): React.CSSProperties {
  const hex = ruleColor ?? manualColor;
  return { backgroundColor: `#${hex}20`, color: `#${hex}` };
}

/** Get classes based on whether a custom color is applied */
export function getConditionalClasses(
  hasCustomColor: boolean,
  defaultClasses: string
): string {
  return hasCustomColor ? "" : defaultClasses;
}

/** Get badge classes based on color rule or change direction */
export function getBadgeClasses(
  ruleBadgeColor: string | undefined,
  isPositive: boolean
): string {
  if (ruleBadgeColor) return "";
  if (isPositive)
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}
