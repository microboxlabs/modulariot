"use client";
import { useMemo } from "react";
import { z } from "zod";
import { createWidgetRegistry } from "../core/widget-registry";
import { evaluateColorRulesWithFields } from "../core/color-rule-evaluation";
import { createTemplateEngine } from "../templates";
import { DetailedStat } from "./detailed-stat";
import { normalizeTargetedColorRules } from "./targeted-color-rules";
import { templateField } from "./scalar-template-field";
import { useWidgetTemplateFields } from "./use-widget-template-fields";
import type { WidgetComponentProps } from "./widget-renderer";
import { templateStatusView } from "./widget-template-status";
export interface DetailedStatRegistryOptions {
  defaultTitle: string;
  defaultUnit: string;
  progressLabel: string;
  previousLabel: string;
  progressSummary: (percent: number) => string;
  loadingLabel: string;
  errorLabel: string;
  unsupportedDataLabel: string;
  formatValue?: (value: number, unit: string) => string;
  formatChange?: (percent: number, positive: boolean) => string;
  templateEngine?: ReturnType<typeof createTemplateEngine>;
}
const targets = ["text", "bar", "badge"] as const;
const comparisonSchema = z.object({
  compareMode: z.enum(["static", "field"]).optional(),
  compareField: z.enum(["previousValue", "target"]).optional(),
});
function comparisonRules(raw: unknown) {
  if (
    !raw ||
    typeof raw !== "object" ||
    !("rules" in raw) ||
    !Array.isArray(raw.rules)
  )
    return [];
  return raw.rules.flatMap((entry: unknown) => {
    const rule = normalizeTargetedColorRules({ rules: [entry] }, targets)[0];
    const comparison = comparisonSchema.safeParse(entry);
    return rule && comparison.success ? [{ ...rule, ...comparison.data }] : [];
  });
}
function numeric(raw: string | undefined) {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}
export function createDetailedStatRegistry(
  options: Readonly<DetailedStatRegistryOptions>,
) {
  const engine = options.templateEngine ?? createTemplateEngine();
  const format =
    options.formatValue ??
    ((value: number, unit: string) => `${unit}${value.toLocaleString()}`);
  function RegisteredDetailedStat({ widget }: Readonly<WidgetComponentProps>) {
    const config = widget.config;
    const fields = useMemo(
      () => ({
        title: templateField(config.title, options.defaultTitle),
        unit: templateField(config.unit, options.defaultUnit),
        description: templateField(config.description, ""),
        value: templateField(config.value, "0"),
        previousValue: templateField(config.previousValue, "0"),
        target: templateField(config.target, "0"),
      }),
      [
        config.title,
        config.unit,
        config.description,
        config.value,
        config.previousValue,
        config.target,
      ],
    );
    const { status, resolved } = useWidgetTemplateFields(
      config,
      fields,
      engine,
    );
    const rules = useMemo(
      () => comparisonRules(config.valueColorRules),
      [config.valueColorRules],
    );
    const pending = templateStatusView(status, options);
    if (pending) return pending;
    const value = numeric(resolved.value),
      previousValue = numeric(resolved.previousValue),
      target = numeric(resolved.target);
    const change = value - previousValue;
    const rawChange = previousValue === 0 ? 0 : (change / previousValue) * 100;
    const changePercent = Number.isFinite(rawChange)
      ? Number(rawChange.toFixed(1))
      : 0;
    const progress =
      target > 0 ? Math.max(0, Math.min(100, (value / target) * 100)) : 0;
    const positive = value >= previousValue;
    const unit = resolved.unit ?? options.defaultUnit;
    const colors = evaluateColorRulesWithFields(
      rules,
      String(value),
      { previousValue, target },
      [...targets],
    );
    return (
      <DetailedStat
        title={resolved.title || options.defaultTitle}
        value={format(value, unit)}
        description={resolved.description ?? ""}
        previousValue={format(previousValue, unit)}
        target={format(target, unit)}
        positive={positive}
        changeLabel={
          options.formatChange?.(changePercent, positive) ??
          `${positive ? "+" : ""}${changePercent}%`
        }
        progress={progress}
        progressLabel={options.progressLabel}
        progressSummary={options.progressSummary(progress)}
        previousLabel={options.previousLabel}
        valueColor={colors.text}
        barColor={colors.bar}
        badgeColor={colors.badge}
      />
    );
  }
  return createWidgetRegistry([
    {
      meta: { id: "stat_detailed", hasChildren: false, hasSettings: false },
      Component: RegisteredDetailedStat,
      getLayoutDefaults: () => ({ minW: 4, minH: 4 }),
    },
  ]);
}
