"use client";
import { useMemo } from "react";
import { createWidgetRegistry } from "../core/widget-registry";
import { evaluateRule } from "../core/color-rules";
import { createTemplateEngine } from "../templates";
import { SparklineStat } from "./sparkline-stat";
import { normalizeScalarThresholds } from "./scalar-thresholds";
import { templateField } from "./scalar-template-field";
import { useWidgetTemplateFields } from "./use-widget-template-fields";
import type { WidgetComponentProps } from "./widget-renderer";
export interface SparklineStatRegistryOptions {
  defaultTitle: string;
  defaultUnit: string;
  /** Explicit legacy fallback; omitted by default to avoid inventing history. */
  defaultSamples?: readonly number[];
  trendLabel?: (values: readonly number[]) => string;
  loadingLabel: string;
  errorLabel: string;
  unsupportedDataLabel: string;
  formatValue?: (value: number) => string;
  locale?: string;
  templateEngine?: ReturnType<typeof createTemplateEngine>;
}
export function createSparklineStatRegistry(
  options: Readonly<SparklineStatRegistryOptions>,
) {
  const engine = options.templateEngine ?? createTemplateEngine();
  const formatter = new Intl.NumberFormat(options.locale);
  function RegisteredSparklineStat({ widget }: Readonly<WidgetComponentProps>) {
    const config = widget.config;
    const samples = useMemo(() => {
      const raw =
        Array.isArray(config.sparkline) && config.sparkline.length >= 2
          ? config.sparkline
          : (options.defaultSamples ?? []);
      return raw.map((value: unknown) => templateField(value, ""));
    }, [config.sparkline]);
    const threshold = useMemo(
      () => normalizeScalarThresholds(config.thresholds),
      [config.thresholds],
    );
    const fields = useMemo(
      () => ({
        ...Object.fromEntries(
          samples.map((value, index) => [`sample-${index}`, value]),
        ),
        title: templateField(config.title, options.defaultTitle),
        value: templateField(config.value, "0"),
        unit: templateField(config.unit, options.defaultUnit),
        threshold: threshold.field,
      }),
      [config.title, config.value, config.unit, threshold.field, samples],
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
    const number = Number(resolved.value);
    const value = Number.isFinite(number) ? number : 0;
    const values = samples.map((_sample, index) => {
      const raw = resolved[`sample-${index}`] ?? "";
      const parsed = Number(raw);
      return raw.trim() && Number.isFinite(parsed) ? parsed : Number.NaN;
    });
    return (
      <SparklineStat
        title={resolved.title || options.defaultTitle}
        value={options.formatValue?.(value) ?? formatter.format(value)}
        unit={resolved.unit ?? options.defaultUnit}
        values={values}
        trendLabel={options.trendLabel?.(values)}
        valueStyle={{ color: match ? `#${match.color}` : undefined }}
      />
    );
  }
  return createWidgetRegistry([
    {
      meta: { id: "stat_sparkline", hasChildren: false, hasSettings: false },
      Component: RegisteredSparklineStat,
      getLayoutDefaults: () => ({ minW: 3, minH: 2 }),
    },
  ]);
}
