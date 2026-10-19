"use client";
import { useMemo } from "react";
import { z } from "zod";
import { createWidgetRegistry } from "../core/widget-registry";
import { evaluateColorRulesGeneric } from "../core/color-rule-evaluation";
import { createTemplateEngine } from "../templates";
import { ExpandableStat } from "./expandable-stat";
import { normalizeTargetedColorRules } from "./targeted-color-rules";
import { templateField } from "./scalar-template-field";
import { useWidgetTemplateFields } from "./use-widget-template-fields";
import type { WidgetComponentProps } from "./widget-renderer";
import { templateStatusView } from "./widget-template-status";
export interface ExpandableStatRegistryOptions {
  defaultTitle: string;
  defaultUnit: string;
  showLabel: string;
  hideLabel: string;
  loadingLabel: string;
  errorLabel: string;
  unsupportedDataLabel: string;
  formatValue?: (value: string) => string;
  templateEngine?: ReturnType<typeof createTemplateEngine>;
}
const detailSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
});
function normalizeDetails(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const parsed = detailSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}
function displayValue(raw: string) {
  const number = Number(raw);
  return raw.trim() && Number.isFinite(number) ? String(number) : raw;
}
const targets = ["text", "bg"] as const;
export function createExpandableStatRegistry(
  options: Readonly<ExpandableStatRegistryOptions>,
) {
  const engine = options.templateEngine ?? createTemplateEngine();
  function RegisteredExpandableStat({
    widget,
  }: Readonly<WidgetComponentProps>) {
    const config = widget.config;
    const details = useMemo(
      () => normalizeDetails(config.details),
      [config.details],
    );
    const fields = useMemo(() => {
      const result: Record<string, string> = {
        title: templateField(config.title, options.defaultTitle),
        value: templateField(config.value, "0"),
        unit: templateField(config.unit, options.defaultUnit),
      };
      details.forEach((detail, index) => {
        result[`label-${index}`] = detail.label;
        result[`value-${index}`] = String(detail.value);
      });
      return result;
    }, [config.title, config.value, config.unit, details]);
    const { status, resolved } = useWidgetTemplateFields(
      config,
      fields,
      engine,
    );
    const rules = useMemo(
      () => normalizeTargetedColorRules(config.valueColorRules, targets),
      [config.valueColorRules],
    );
    const pending = templateStatusView(status, options);
    if (pending) return pending;
    const value = displayValue(resolved.value ?? "");
    const colors = evaluateColorRulesGeneric(rules, value, [...targets]);
    return (
      <ExpandableStat
        resetKey={widget.id}
        title={resolved.title || options.defaultTitle}
        value={options.formatValue?.(value) ?? value}
        unit={resolved.unit ?? options.defaultUnit}
        details={details.map((_detail, index) => ({
          label: resolved[`label-${index}`] ?? "",
          value: resolved[`value-${index}`] ?? "",
        }))}
        showLabel={options.showLabel}
        hideLabel={options.hideLabel}
        backgroundColor={colors.bg}
        valueColor={
          colors.text ??
          (typeof config.valueColor === "string"
            ? config.valueColor
            : undefined)
        }
      />
    );
  }
  return createWidgetRegistry([
    {
      meta: { id: "stat_expandable", hasChildren: false, hasSettings: false },
      Component: RegisteredExpandableStat,
      getLayoutDefaults: () => ({ minW: 3, minH: 4 }),
    },
  ]);
}
