"use client";
import { useMemo } from "react";
import { z } from "zod";
import { createWidgetRegistry } from "../core/widget-registry";
import { createTemplateEngine } from "../templates";
import { StackedStat } from "./stacked-stat";
import { templateField } from "./scalar-template-field";
import { useWidgetTemplateFields } from "./use-widget-template-fields";
import type { WidgetComponentProps } from "./widget-renderer";
export interface StackedStatRegistryOptions {
  defaultTitle: string;
  defaultUnit: string;
  loadingLabel: string;
  errorLabel: string;
  unsupportedDataLabel: string;
  emptyLabel: string;
  formatValue?: (value: number) => string;
  templateEngine?: ReturnType<typeof createTemplateEngine>;
}
const itemSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  color: z.string().optional(),
});
function normalizeItems(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const parsed = itemSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}
export function createStackedStatRegistry(
  options: Readonly<StackedStatRegistryOptions>,
) {
  const engine = options.templateEngine ?? createTemplateEngine();
  function RegisteredStackedStat({ widget }: Readonly<WidgetComponentProps>) {
    const config = widget.config;
    const items = useMemo(() => normalizeItems(config.items), [config.items]);
    const fields = useMemo(() => {
      const result: Record<string, string> = {
        title: templateField(config.title, options.defaultTitle),
        unit: templateField(config.unit, options.defaultUnit),
      };
      items.forEach((item, index) => {
        result[`label-${index}`] = item.label;
        result[`value-${index}`] = String(item.value);
      });
      return result;
    }, [config.title, config.unit, items]);
    const { status, resolved } = useWidgetTemplateFields(
      config,
      fields,
      engine,
    );
    if (status === "loading") return <output>{options.loadingLabel}</output>;
    if (status === "error") return <p role="alert">{options.errorLabel}</p>;
    if (status === "unsupported")
      return <p role="alert">{options.unsupportedDataLabel}</p>;
    if (!items.length) return <p>{options.emptyLabel}</p>;
    const values = items.map((item, index) => ({
      label: resolved[`label-${index}`] ?? "",
      value: Number(resolved[`value-${index}`]),
      color: (item.color ?? "").replace(/^#/, ""),
    }));
    return (
      <StackedStat
        title={resolved.title || options.defaultTitle}
        unit={resolved.unit ?? options.defaultUnit}
        items={values}
        showHeader={config.showHeader !== false}
        chartType={config.chartType === "donut" ? "donut" : "bar"}
        formatValue={options.formatValue}
      />
    );
  }
  return createWidgetRegistry([
    {
      meta: { id: "stat_stacked", hasChildren: false, hasSettings: false },
      Component: RegisteredStackedStat,
      getLayoutDefaults: () => ({ minW: 4, minH: 2 }),
    },
  ]);
}
