import { useMemo } from "react";
import type { ThresholdConfig, ThresholdTarget } from "./threshold-types";
import { evaluateThreshold } from "./threshold-engine";
import { resolveHandlebarsField } from "./use-handlebars-templates";
import { normalizeThresholdConfig } from "./threshold-helpers";

export interface ThresholdResult {
  /** The matched color, or null if no match / disabled */
  color: string | null;
  /** Whether threshold color should apply to a given target */
  appliesTo: (target: ThresholdTarget) => boolean;
}

export interface ThresholdOptions {
  /**
   * Fallback value to use for rule evaluation when the threshold field is empty.
   * This allows dashlets to provide a default value (e.g., the progress bar value)
   * without requiring the user to configure the "Evaluate field" explicitly.
   */
  fallbackValue?: string | number;
}

/**
 * Convenience hook for Pattern A dashlets that use useDashletPgrest.
 * Builds the template context from firstRow and evaluates thresholds.
 */
export function useRowThreshold(
  thresholds: ThresholdConfig | undefined,
  firstRow: Record<string, unknown> | undefined,
  options?: ThresholdOptions
): ThresholdResult {
  const templateContext = useMemo(
    () => (firstRow ? { ...firstRow, row: firstRow } : {}),
    [firstRow]
  );
  return useThreshold(thresholds, templateContext, options);
}

/**
 * Evaluate threshold config against a template context.
 * Returns the matched color and a helper to check apply targets.
 *
 * @param thresholds - The threshold configuration
 * @param templateContext - Context for resolving handlebars templates
 * @param options - Optional settings including fallbackValue for when field is empty
 */
export function useThreshold(
  thresholds: ThresholdConfig | undefined,
  templateContext: Record<string, unknown>,
  options?: ThresholdOptions
): ThresholdResult {
  return useMemo(() => {
    const config = normalizeThresholdConfig(thresholds);
    if (!config.enabled || config.rules.length === 0) {
      return { color: null, appliesTo: () => false };
    }

    // Determine the value to evaluate: use configured field if set, otherwise fallback
    let resolvedValue: string;
    if (config.field) {
      resolvedValue = resolveHandlebarsField(config.field, templateContext);
    } else if (options?.fallbackValue === undefined) {
      // No field and no fallback — cannot evaluate
      return { color: null, appliesTo: () => false };
    } else {
      // Use fallback value when field is empty (e.g., the dashlet's main value)
      resolvedValue = String(options.fallbackValue);
    }

    const color = evaluateThreshold(config, resolvedValue);

    if (!color) {
      return { color: null, appliesTo: () => false };
    }

    const targets = new Set(config.applyTo);
    return {
      color,
      appliesTo: (target: ThresholdTarget) => targets.has(target),
    };
  }, [thresholds, templateContext, options?.fallbackValue]);
}
