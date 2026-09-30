"use client";
import { useMemo } from "react";
import { createWidgetRegistry } from "../core/widget-registry";
import { evaluateRule, type ColorRuleOperator } from "../core/color-rules";
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
const operators = new Set<string>([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "greater_than",
  "less_than",
  "greater_than_or_equal",
  "less_than_or_equal",
]);
function normalizeRules(raw: unknown) {
  if (
    !raw ||
    typeof raw !== "object" ||
    !("rules" in raw) ||
    !Array.isArray(raw.rules)
  )
    return [];
  return raw.rules.flatMap((entry: unknown) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      !("operator" in entry) ||
      typeof entry.operator !== "string" ||
      !operators.has(entry.operator) ||
      !("color" in entry) ||
      typeof entry.color !== "string"
    )
      return [];
    return [
      {
        operator: entry.operator as ColorRuleOperator,
        color: entry.color,
        value:
          "value" in entry && typeof entry.value === "string"
            ? entry.value
            : "",
      },
    ];
  });
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
        value: String(config.value ?? "6"),
        max: String(config.max ?? "10"),
      }),
      [config.title, config.value, config.max],
    );
    const { status, resolved } = useWidgetTemplateFields(
      config,
      fields,
      engine,
    );
    const rules = useMemo(
      () => sortColorRules(normalizeRules(config.barColorRules)),
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
    const evalValue = String(
      countMode ? value : max > 0 ? Math.round((value / max) * 100) : 0,
    );
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
