"use client";
import { templateField } from "./scalar-template-field";
import { useMemo } from "react";
import { createWidgetRegistry } from "../core/widget-registry";
import { evaluateRule } from "../core/color-rules";
import {
  isGreaterOperator,
  isLessOperator,
} from "../core/color-rule-evaluation";
import { createTemplateEngine } from "../templates";
import { CircularStat } from "./circular-stat";
import { useWidgetTemplateFields } from "./use-widget-template-fields";
import { normalizeScalarColorRules } from "./scalar-color-rules";
import type { WidgetComponentProps } from "./widget-renderer";
export interface CircularStatRegistryOptions {
  defaultTitle: string;
  defaultUnit: string;
  loadingLabel: string;
  errorLabel: string;
  unsupportedDataLabel: string;
  /** Return a complete localized footer from resolved maximum and unit. */
  formatTotal: (max: string, unit: string) => string;
  templateEngine?: ReturnType<typeof createTemplateEngine>;
}
function ringRules(raw: unknown) {
  const rules = normalizeScalarColorRules(raw);
  // Sort only consecutive thresholds of the same direction. Mixed operators
  // keep their historical positions without a non-transitive comparator.
  for (let start = 0; start < rules.length;) {
    const operator = rules[start]!.operator;
    const greater = isGreaterOperator(operator);
    const sameDirection = greater ? isGreaterOperator : isLessOperator;
    if (!sameDirection(operator)) {
      start += 1;
      continue;
    }
    let end = start + 1;
    while (end < rules.length && sameDirection(rules[end]!.operator)) end += 1;
    const ordered = rules.slice(start, end).sort((a, b) => {
      const difference = (Number(a.value) || 0) - (Number(b.value) || 0);
      return greater ? -difference : difference;
    });
    rules.splice(start, ordered.length, ...ordered);
    start = end;
  }
  return rules;
}
export function createCircularStatRegistry(
  options: Readonly<CircularStatRegistryOptions>,
) {
  const engine = options.templateEngine ?? createTemplateEngine();
  function RegisteredCircularStat({ widget }: Readonly<WidgetComponentProps>) {
    const config = widget.config;
    const fields = useMemo(
      () => ({
        title: templateField(config.title, options.defaultTitle),
        value: templateField(config.value, "67"),
        max: templateField(config.maxValue, "100"),
        unit: templateField(config.unit, options.defaultUnit),
      }),
      [config.title, config.value, config.maxValue, config.unit],
    );
    const { status, resolved } = useWidgetTemplateFields(
      config,
      fields,
      engine,
    );
    const rules = useMemo(
      () => ringRules(config.ringColorRules),
      [config.ringColorRules],
    );
    if (status === "unsupported")
      return <p role="alert">{options.unsupportedDataLabel}</p>;
    if (status === "loading") return <output>{options.loadingLabel}</output>;
    if (status === "error") return <p role="alert">{options.errorLabel}</p>;
    const value = Number(resolved.value) || 0;
    const max = Number(resolved.max) || 0;
    const match = rules.find((rule) =>
      evaluateRule({ ...rule, column: "" }, String(value)),
    );
    const color =
      match?.color ??
      (typeof config.ringColor === "string" ? config.ringColor : "3b82f6");
    return (
      <CircularStat
        title={resolved.title?.trim() ? resolved.title : options.defaultTitle}
        value={value}
        max={max}
        valueLabel={resolved.value ?? ""}
        unit={resolved.unit ?? ""}
        totalLabel={options.formatTotal(
          resolved.max ?? "",
          resolved.unit ?? "",
        )}
        ringColor={color}
      />
    );
  }
  return createWidgetRegistry([
    {
      meta: { id: "stat_circular", hasChildren: false, hasSettings: false },
      Component: RegisteredCircularStat,
      getLayoutDefaults: () => ({ minW: 3, minH: 3 }),
    },
  ]);
}
