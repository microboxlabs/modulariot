import { useMemo } from "react";
import type { RuleColor } from "./color-rule-types";
import type { ThresholdConfig, ThresholdTarget } from "./threshold-types";
import { evaluateThreshold } from "./threshold-engine";
import { resolveHandlebarsField } from "./use-handlebars-templates";
import { normalizeThresholdConfig } from "./threshold-helpers";

export interface ThresholdResult {
  /** The matched color, or null if no match / disabled */
  color: RuleColor | null;
  /** Whether threshold color should apply to a given target */
  appliesTo: (target: ThresholdTarget) => boolean;
}

/**
 * Convenience hook for Pattern A dashlets that use useDashletPgrest.
 * Builds the template context from firstRow and evaluates thresholds.
 */
export function useRowThreshold(
  thresholds: ThresholdConfig | undefined,
  firstRow: Record<string, unknown> | undefined,
): ThresholdResult {
  const templateContext = useMemo(
    () => (firstRow ? { ...firstRow, row: firstRow } : {}),
    [firstRow],
  );
  return useThreshold(thresholds, templateContext);
}

/**
 * Evaluate threshold config against a template context.
 * Returns the matched color and a helper to check apply targets.
 */
export function useThreshold(
  thresholds: ThresholdConfig | undefined,
  templateContext: Record<string, unknown>,
): ThresholdResult {
  return useMemo(() => {
    const config = normalizeThresholdConfig(thresholds);
    if (!config.enabled || !config.field || config.rules.length === 0) {
      return { color: null, appliesTo: () => false };
    }

    const resolvedValue = resolveHandlebarsField(config.field, templateContext);
    const color = evaluateThreshold(config, resolvedValue);

    if (!color) {
      return { color: null, appliesTo: () => false };
    }

    const targets = new Set(config.applyTo);
    return {
      color,
      appliesTo: (target: ThresholdTarget) => targets.has(target),
    };
  }, [thresholds, templateContext]);
}
