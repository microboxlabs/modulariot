import type { RuleColor } from "./color-rule-types";
import type { ThresholdConfig } from "./threshold-types";
import { evaluateRule } from "./color-rule-engine";

// ============================================================================
// Evaluation
// ============================================================================

/**
 * Evaluate threshold rules against a resolved field value.
 * Returns the first matching color or null.
 */
export function evaluateThreshold(
  config: ThresholdConfig,
  resolvedFieldValue: string,
): RuleColor | null {
  if (!config.enabled || config.rules.length === 0) return null;

  for (const rule of config.rules) {
    // Reuse evaluateRule by constructing a synthetic ColorRule
    const syntheticRule = { column: "", operator: rule.operator, value: rule.value, color: rule.color };
    if (evaluateRule(syntheticRule, resolvedFieldValue)) {
      return rule.color;
    }
  }
  return null;
}

// ============================================================================
// Tailwind class mappings (static strings — safe for Tailwind purge)
// ============================================================================

export function getThresholdBgClasses(color: RuleColor): string {
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
  }
}

export function getThresholdTextClasses(color: RuleColor): string {
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
  }
}

export function getThresholdIconClasses(color: RuleColor): { bg: string; text: string } {
  return {
    bg: getThresholdBgClasses(color),
    text: getThresholdTextClasses(color),
  };
}

export function getThresholdBorderClasses(color: RuleColor): string {
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
  }
}

export function getThresholdStrokeClass(color: RuleColor): string {
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
  }
}

export function getThresholdBarClass(color: RuleColor): string {
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
  }
}

export function getThresholdGradientClasses(color: RuleColor): { from: string; to: string } {
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
  }
}
