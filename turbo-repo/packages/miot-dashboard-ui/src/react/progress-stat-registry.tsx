"use client";
import { useMemo } from "react";
import { createWidgetRegistry } from "../core/widget-registry";
import { evaluateRule } from "../core/color-rules";
import { createTemplateEngine } from "../templates";
import { ProgressStat } from "./progress-stat";
import { normalizeScalarColorRules } from "./scalar-color-rules";
import { templateField } from "./scalar-template-field";
import { useWidgetTemplateFields } from "./use-widget-template-fields";
import type { WidgetComponentProps } from "./widget-renderer";
import { templateStatusView } from "./widget-template-status";
export interface ProgressStatRegistryOptions {
  defaultTitle: string;
  defaultUnit: string;
  formatValue?: (value: number, target: number, unit: string) => string;
  loadingLabel: string;
  errorLabel: string;
  unsupportedDataLabel: string;
  templateEngine?: ReturnType<typeof createTemplateEngine>;
}
const namedColors: Record<string, string> = {
  red: "ef4444",
  yellow: "eab308",
  green: "22c55e",
  blue: "3b82f6",
  orange: "f97316",
  purple: "a855f7",
  gray: "6b7280",
};
function thresholdConfig(raw: unknown) {
  if (!raw || typeof raw !== "object")
    return { field: "", targets: [], rules: [] };
  const field =
    "field" in raw && typeof raw.field === "string" ? raw.field : "";
  const targets =
    "applyTo" in raw && Array.isArray(raw.applyTo) ? raw.applyTo : ["text"];
  const enabled = "enabled" in raw && raw.enabled === true;
  const entries = "rules" in raw && Array.isArray(raw.rules) ? raw.rules : [];
  const rules = normalizeScalarColorRules({
    rules: entries.map((entry: unknown) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        !("color" in entry) ||
        typeof entry.color !== "string"
      )
        return entry;
      const color = Object.hasOwn(namedColors, entry.color)
        ? namedColors[entry.color]
        : entry.color;
      return { ...entry, color };
    }),
  });
  return { field: enabled ? field : "", targets, rules };
}
function number(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) ? parsed : fallback;
}
export function createProgressStatRegistry(
  options: Readonly<ProgressStatRegistryOptions>,
) {
  const engine = options.templateEngine ?? createTemplateEngine();
  function RegisteredProgressStat({ widget }: Readonly<WidgetComponentProps>) {
    const config = widget.config;
    const threshold = useMemo(
      () => thresholdConfig(config.thresholds),
      [config.thresholds],
    );
    const fields = useMemo(
      () => ({
        title: templateField(config.title, options.defaultTitle),
        value: templateField(config.value, "78"),
        target: templateField(config.target, "100"),
        unit: templateField(config.unit, options.defaultUnit),
        threshold: threshold.field,
      }),
      [config.title, config.value, config.target, config.unit, threshold.field],
    );
    const { status, resolved } = useWidgetTemplateFields(
      config,
      fields,
      engine,
    );
    const rules = useMemo(
      () => normalizeScalarColorRules(config.barColorRules),
      [config.barColorRules],
    );
    const pending = templateStatusView(status, options);
    if (pending) return pending;
    const value = number(resolved.value, 0);
    const match = rules.find((rule) =>
      evaluateRule({ ...rule, column: "" }, String(value)),
    );
    const thresholdMatch = threshold.field
      ? threshold.rules.find((rule) =>
          evaluateRule({ ...rule, column: "" }, resolved.threshold ?? ""),
        )
      : undefined;
    const thresholdBar = threshold.targets.includes("background")
      ? thresholdMatch?.color
      : undefined;
    const textColor = threshold.targets.includes("text")
      ? thresholdMatch?.color
      : undefined;
    return (
      <ProgressStat
        title={resolved.title?.trim() ? resolved.title : options.defaultTitle}
        value={value}
        target={number(resolved.target, 100)}
        unit={resolved.unit ?? options.defaultUnit}
        barColor={match?.color ?? thresholdBar}
        textColor={textColor}
        formatValue={options.formatValue}
      />
    );
  }
  return createWidgetRegistry([
    {
      meta: { id: "stat_progress", hasChildren: false, hasSettings: false },
      Component: RegisteredProgressStat,
      getLayoutDefaults: () => ({ minW: 3, minH: 2 }),
    },
  ]);
}
