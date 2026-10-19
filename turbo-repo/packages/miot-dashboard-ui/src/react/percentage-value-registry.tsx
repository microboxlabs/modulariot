"use client";
import { normalizeScalarColorRules } from "./scalar-color-rules";
import { templateField } from "./scalar-template-field";
import { useMemo } from "react";
import { createWidgetRegistry } from "../core/widget-registry";
import { evaluateRule } from "../core/color-rules";
import { sortColorRules } from "../core/color-rule-evaluation";
import { createTemplateEngine } from "../templates";
import { PercentageValue } from "./percentage-value";
import { useWidgetTemplateFields } from "./use-widget-template-fields";
import type { WidgetComponentProps } from "./widget-renderer";
export interface PercentageValueRegistryOptions {
  defaultTitle: string;
  loadingLabel: string;
  errorLabel: string;
  unsupportedDataLabel: string;
  templateEngine?: ReturnType<typeof createTemplateEngine>;
}
function resolvedNumber(value: string | undefined, fallback: number) {
  const parsed =
    value === "" || value === undefined ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
export function createPercentageValueRegistry(
  options: Readonly<PercentageValueRegistryOptions>,
) {
  const engine = options.templateEngine ?? createTemplateEngine();
  function RegisteredPercentageValue({
    widget,
  }: Readonly<WidgetComponentProps>) {
    const config = widget.config;
    const fields = useMemo(
      () => ({
        title:
          typeof config.title === "string" && config.title
            ? config.title
            : options.defaultTitle,
        value: templateField(config.value, "6"),
        max: templateField(config.max, "10"),
      }),
      [config.title, config.value, config.max],
    );
    const { status, resolved } = useWidgetTemplateFields(
      config,
      fields,
      engine,
    );
    const rules = useMemo(
      () => sortColorRules(normalizeScalarColorRules(config.barColorRules)),
      [config.barColorRules],
    );
    if (status === "unsupported")
      return <p role="alert">{options.unsupportedDataLabel}</p>;
    if (status === "loading") return <output>{options.loadingLabel}</output>;
    if (status === "error") return <p role="alert">{options.errorLabel}</p>;
    const value = resolvedNumber(resolved.value, 0);
    const max = resolvedNumber(resolved.max, 10);
    const rawRules = config.barColorRules;
    const countMode =
      !!rawRules &&
      typeof rawRules === "object" &&
      "evalMode" in rawRules &&
      rawRules.evalMode === "count";
    const percentage = max > 0 ? Math.round((value / max) * 100) : 0;
    const evalValue = String(countMode ? value : percentage);
    const match = rules.find((rule) =>
      evaluateRule({ ...rule, column: "" }, evalValue),
    );
    const color =
      match?.color ??
      (typeof config.barColor === "string" ? config.barColor : "2563eb");
    return (
      <PercentageValue
        title={resolved.title || options.defaultTitle}
        value={value}
        max={max}
        barColor={color}
      />
    );
  }
  return createWidgetRegistry([
    {
      meta: { id: "percentage_value", hasChildren: false, hasSettings: false },
      Component: RegisteredPercentageValue,
      getLayoutDefaults: () => ({ minW: 3, minH: 1 }),
    },
  ]);
}
