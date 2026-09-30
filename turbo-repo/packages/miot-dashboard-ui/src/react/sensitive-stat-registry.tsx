"use client";
import { useMemo } from "react";
import { createWidgetRegistry } from "../core/widget-registry";
import { evaluateRule } from "../core/color-rules";
import { createTemplateEngine } from "../templates";
import { SensitiveStat } from "./sensitive-stat";
import { normalizeScalarThresholds } from "./scalar-thresholds";
import { templateField } from "./scalar-template-field";
import { useWidgetTemplateFields } from "./use-widget-template-fields";
import type { WidgetComponentProps } from "./widget-renderer";
export interface SensitiveStatRegistryOptions {
  defaultTitle: string;
  defaultUnit: string;
  showLabel: string;
  hideLabel: string;
  hint?: string;
  loadingLabel: string;
  errorLabel: string;
  unsupportedDataLabel: string;
  /** Override numeric formatting and unit placement; raw text is used for nonnumeric values. */
  formatValue?: (value: string, unit: string) => string;
  locale?: string;
  templateEngine?: ReturnType<typeof createTemplateEngine>;
}
export function createSensitiveStatRegistry(
  options: Readonly<SensitiveStatRegistryOptions>,
) {
  const engine = options.templateEngine ?? createTemplateEngine();
  const formatter = new Intl.NumberFormat(options.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  function format(raw: string, unit: string) {
    if (options.formatValue) return options.formatValue(raw, unit);
    const number = Number(raw);
    return (
      unit +
      (raw.trim() && Number.isFinite(number) ? formatter.format(number) : raw)
    );
  }
  function RegisteredSensitiveStat({ widget }: Readonly<WidgetComponentProps>) {
    const config = widget.config;
    const threshold = useMemo(
      () => normalizeScalarThresholds(config.thresholds),
      [config.thresholds],
    );
    const fields = useMemo(
      () => ({
        title: templateField(config.title, options.defaultTitle),
        value: templateField(config.value, "0"),
        unit: templateField(config.unit, options.defaultUnit),
        threshold: threshold.field,
      }),
      [config.title, config.value, config.unit, threshold.field],
    );
    const { status, resolved } = useWidgetTemplateFields(
      config,
      fields,
      engine,
    );
    if (status === "loading") return <output>{options.loadingLabel}</output>;
    if (status === "error") return <p role="alert">{options.errorLabel}</p>;
    if (status === "unsupported")
      return <p role="alert">{options.unsupportedDataLabel}</p>;
    const match =
      threshold.field && threshold.targets.includes("text")
        ? threshold.rules.find((rule) =>
            evaluateRule({ ...rule, column: "" }, resolved.threshold ?? ""),
          )
        : undefined;
    return (
      <SensitiveStat
        resetKey={widget.id}
        title={resolved.title || options.defaultTitle}
        value={format(
          resolved.value ?? "",
          resolved.unit ?? options.defaultUnit,
        )}
        sensitive={config.isSensitive !== false}
        showLabel={options.showLabel}
        hideLabel={options.hideLabel}
        hint={options.hint}
        valueStyle={{ color: match ? `#${match.color}` : undefined }}
      />
    );
  }
  return createWidgetRegistry([
    {
      meta: { id: "stat_sensitive", hasChildren: false, hasSettings: false },
      Component: RegisteredSensitiveStat,
      getLayoutDefaults: () => ({ minW: 3, minH: 2 }),
    },
  ]);
}
