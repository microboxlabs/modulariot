"use client";
import { useMemo, type ReactNode } from "react";
import { createWidgetRegistry } from "../core/widget-registry";
import { evaluateColorRulesGeneric } from "../core/color-rule-evaluation";
import { createTemplateEngine } from "../templates";
import { StatusStat } from "./status-stat";
import { normalizeScalarColorRules } from "./scalar-color-rules";
import { templateField } from "./scalar-template-field";
import { useWidgetTemplateFields } from "./use-widget-template-fields";
import type { WidgetComponentProps } from "./widget-renderer";

export interface StatusStatRegistryOptions {
  defaultTitle: string;
  loadingLabel: string;
  errorLabel: string;
  unsupportedDataLabel: string;
  /** Host-owned decorative icon lookup. Unknown names should return a fallback. */
  renderIcon?: (name: string) => ReactNode;
  templateEngine?: ReturnType<typeof createTemplateEngine>;
}
const targets = ["border", "icon", "text"] as const;
function statusRules(raw: unknown) {
  if (
    !raw ||
    typeof raw !== "object" ||
    !("rules" in raw) ||
    !Array.isArray(raw.rules)
  )
    return [];
  return raw.rules.flatMap((entry: unknown) => {
    const rule = normalizeScalarColorRules({ rules: [entry] })[0];
    if (!rule || rule.color.length !== 6 || !entry || typeof entry !== "object")
      return [];
    const requested =
      "targets" in entry && Array.isArray(entry.targets)
        ? entry.targets
        : ["target" in entry ? entry.target : "text"];
    const selected = targets.filter((target) => requested.includes(target));
    return [{ ...rule, targets: selected.length ? selected : ["text"] }];
  });
}
export function createStatusStatRegistry(
  options: Readonly<StatusStatRegistryOptions>,
) {
  const engine = options.templateEngine ?? createTemplateEngine();
  function RegisteredStatusStat({ widget }: Readonly<WidgetComponentProps>) {
    const config = widget.config;
    const fields = useMemo(
      () => ({
        title: templateField(config.title, options.defaultTitle),
        value: templateField(config.value, "0"),
        subtitle: templateField(config.subtitle, ""),
      }),
      [config.title, config.value, config.subtitle],
    );
    const { status, resolved } = useWidgetTemplateFields(
      config,
      fields,
      engine,
    );
    const rules = useMemo(
      () => statusRules(config.valueColorRules),
      [config.valueColorRules],
    );
    if (status === "loading") return <output>{options.loadingLabel}</output>;
    if (status === "error") return <p role="alert">{options.errorLabel}</p>;
    if (status === "unsupported")
      return <p role="alert">{options.unsupportedDataLabel}</p>;
    const colors = evaluateColorRulesGeneric(rules, resolved.value ?? "", [
      ...targets,
    ]);
    const base =
      config.showColor === true && typeof config.color === "string"
        ? config.color
        : undefined;
    return (
      <StatusStat
        title={resolved.title ?? options.defaultTitle}
        value={resolved.value ?? ""}
        subtitle={resolved.subtitle}
        icon={options.renderIcon?.(
          typeof config.icon === "string" ? config.icon : "check",
        )}
        borderColor={colors.border ?? base}
        iconColor={colors.icon ?? base}
        valueColor={colors.text ?? base}
      />
    );
  }
  return createWidgetRegistry([
    {
      meta: { id: "stat_status", hasChildren: false, hasSettings: false },
      Component: RegisteredStatusStat,
      getLayoutDefaults: () => ({ minW: 3, minH: 2 }),
    },
  ]);
}
