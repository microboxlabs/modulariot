"use client";
import { useMemo, type ReactNode } from "react";
import { createWidgetRegistry } from "../core/widget-registry";
import { evaluateColorRulesGeneric } from "../core/color-rule-evaluation";
import { createTemplateEngine } from "../templates";
import { StatusStat } from "./status-stat";
import { normalizeTargetedColorRules } from "./targeted-color-rules";
import { templateField } from "./scalar-template-field";
import { useWidgetTemplateFields } from "./use-widget-template-fields";
import type { WidgetComponentProps } from "./widget-renderer";
import { templateStatusView } from "./widget-template-status";

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
      () => normalizeTargetedColorRules(config.valueColorRules, targets),
      [config.valueColorRules],
    );
    const pending = templateStatusView(status, options);
    if (pending) return pending;
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
