import type { ThresholdConfig } from "./threshold-types";
import { evaluateRule } from "./color-rule-engine";

// ============================================================================
// Helper functions for hex color support
// ============================================================================

const LEGACY_NAMED_COLORS = new Set([
  "red",
  "yellow",
  "green",
  "blue",
  "gray",
  "orange",
  "purple",
]);

export function isLegacyColor(color: string): boolean {
  return LEGACY_NAMED_COLORS.has(color);
}

export function isHexColor(color: string): boolean {
  return /^[0-9a-fA-F]{6}$/.test(color);
}

// ============================================================================
// Evaluation
// ============================================================================

/**
 * Evaluate threshold rules against a resolved field value.
 * Returns the first matching color or null.
 */
export function evaluateThreshold(
  config: ThresholdConfig,
  resolvedFieldValue: string
): string | null {
  if (!config.enabled || config.rules.length === 0) return null;

  for (const rule of config.rules) {
    // Reuse evaluateRule by constructing a synthetic ColorRule
    const syntheticRule = {
      column: "",
      operator: rule.operator,
      value: rule.value,
      color: rule.color,
    };
    if (evaluateRule(syntheticRule, resolvedFieldValue)) {
      return rule.color;
    }
  }
  return null;
}

// ============================================================================
// Tailwind class mappings (static strings — safe for Tailwind purge)
// ============================================================================

export function getThresholdBgClasses(color: string): string {
  if (!isLegacyColor(color)) return "";
  switch (color) {
    case "red":
      return "bg-red-100 dark:bg-red-900/30";
    case "yellow":
      return "bg-yellow-100 dark:bg-yellow-900/30";
    case "green":
      return "bg-green-100 dark:bg-green-900/30";
    case "blue":
      return "bg-blue-100 dark:bg-blue-900/30";
    case "orange":
      return "bg-orange-100 dark:bg-orange-900/30";
    case "purple":
      return "bg-purple-100 dark:bg-purple-900/30";
    case "gray":
      return "bg-gray-100 dark:bg-gray-700";
    default:
      return "";
  }
}

export function getThresholdTextClasses(color: string): string {
  if (!isLegacyColor(color)) return "";
  switch (color) {
    case "red":
      return "text-red-600 dark:text-red-400";
    case "yellow":
      return "text-yellow-600 dark:text-yellow-400";
    case "green":
      return "text-green-600 dark:text-green-400";
    case "blue":
      return "text-blue-600 dark:text-blue-400";
    case "orange":
      return "text-orange-600 dark:text-orange-400";
    case "purple":
      return "text-purple-600 dark:text-purple-400";
    case "gray":
      return "text-gray-600 dark:text-gray-400";
    default:
      return "";
  }
}

/**
 * Get inline text color style for hex colors.
 * Returns undefined for legacy colors (use getThresholdTextClasses instead).
 */
export function getThresholdTextStyle(
  color: string
): React.CSSProperties | undefined {
  if (!isHexColor(color)) return undefined;
  return { color: `#${color}` };
}

export function getThresholdIconClasses(color: string): {
  bg: string;
  text: string;
} {
  return {
    bg: getThresholdBgClasses(color),
    text: getThresholdTextClasses(color),
  };
}

export function getThresholdBorderClasses(color: string): string {
  if (!isLegacyColor(color)) return "";
  switch (color) {
    case "red":
      return "border-l-red-500";
    case "yellow":
      return "border-l-yellow-500";
    case "green":
      return "border-l-green-500";
    case "blue":
      return "border-l-blue-500";
    case "orange":
      return "border-l-orange-400";
    case "purple":
      return "border-l-purple-500";
    case "gray":
      return "border-l-gray-400";
    default:
      return "";
  }
}

export function getThresholdStrokeClass(color: string): string {
  if (!isLegacyColor(color)) return "";
  switch (color) {
    case "red":
      return "stroke-red-500";
    case "yellow":
      return "stroke-yellow-500";
    case "green":
      return "stroke-green-500";
    case "blue":
      return "stroke-blue-500";
    case "orange":
      return "stroke-orange-500";
    case "purple":
      return "stroke-purple-500";
    case "gray":
      return "stroke-gray-500";
    default:
      return "";
  }
}

/**
 * Get inline stroke style for hex colors.
 * Returns undefined for legacy colors (use getThresholdStrokeClass instead).
 */
export function getThresholdStrokeStyle(
  color: string
): React.CSSProperties | undefined {
  if (!isHexColor(color)) return undefined;
  return { stroke: `#${color}` };
}

export function getThresholdBarClass(color: string): string {
  if (!isLegacyColor(color)) return "";
  switch (color) {
    case "red":
      return "bg-red-500";
    case "yellow":
      return "bg-yellow-500";
    case "green":
      return "bg-green-500";
    case "blue":
      return "bg-blue-500";
    case "orange":
      return "bg-orange-500";
    case "purple":
      return "bg-purple-500";
    case "gray":
      return "bg-gray-500";
    default:
      return "";
  }
}

/**
 * Get inline background style for hex colors.
 * Returns undefined for legacy colors (use getThresholdBarClass instead).
 */
export function getThresholdBarStyle(
  color: string
): React.CSSProperties | undefined {
  if (!isHexColor(color)) return undefined;
  return { backgroundColor: `#${color}` };
}

export function getThresholdGradientClasses(color: string): {
  from: string;
  to: string;
} {
  if (!isLegacyColor(color)) return { from: "", to: "" };
  switch (color) {
    case "red":
      return { from: "from-red-500", to: "to-red-600" };
    case "yellow":
      return { from: "from-yellow-400", to: "to-yellow-500" };
    case "green":
      return { from: "from-green-500", to: "to-green-600" };
    case "blue":
      return { from: "from-blue-500", to: "to-blue-600" };
    case "orange":
      return { from: "from-orange-500", to: "to-orange-600" };
    case "purple":
      return { from: "from-purple-500", to: "to-purple-600" };
    case "gray":
      return { from: "from-gray-500", to: "to-gray-600" };
    default:
      return { from: "", to: "" };
  }
}
