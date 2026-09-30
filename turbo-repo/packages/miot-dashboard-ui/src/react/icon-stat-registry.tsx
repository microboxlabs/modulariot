"use client";
import { useMemo, type ReactNode } from "react";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import { createWidgetRegistry } from "../core/widget-registry";
import { evaluateColorRulesGeneric } from "../core/color-rule-evaluation";
import { isSafeActionUrl } from "../core/action-helpers";
import { createTemplateEngine } from "../templates";
import { IconStat } from "./icon-stat";
import { normalizeTargetedColorRules } from "./targeted-color-rules";
import { templateField } from "./scalar-template-field";
import { useWidgetTemplateFields } from "./use-widget-template-fields";
import type { WidgetComponentProps } from "./widget-renderer";
export interface IconStatRegistryOptions {
  defaultTitle: string;
  loadingLabel: string;
  errorLabel: string;
  unsupportedDataLabel: string;
  renderIcon?: (name: string) => ReactNode;
  /** Optional trusted, sanitized rich-text renderer. Defaults to literal text. */
  renderDescription?: (text: string) => ReactNode;
  formatValue?: (value: number) => string;
  templateEngine?: ReturnType<typeof createTemplateEngine>;
}
const targets = ["text", "bg", "icon"] as const;
function color(raw: unknown) {
  return typeof raw === "string" && /^[\da-f]{6}$/i.test(raw)
    ? `#${raw}`
    : undefined;
}
function destination(raw: string | undefined) {
  const url = raw?.trim() ?? "";
  if (!url || !isSafeActionUrl(url)) return undefined;
  return /^(?:[a-z][\w+.-]*:|\/)/i.test(url) ? url : `/${url}`;
}
function presentationStyles(
  config: Widget["config"],
  matched: Partial<Record<(typeof targets)[number], string>>,
) {
  const background = color(
    matched.bg ?? (config.showBgColor === true ? config.bgColor : undefined),
  );
  const foreground = color(
    matched.text ??
      (config.showValueColor === true ? config.valueColor : undefined),
  );
  const iconColor = color(matched.icon ?? config.iconColor ?? "3b82f6");
  const secondary = color(
    config.showSecondaryColor === true ? config.secondaryColor : undefined,
  );
  return {
    containerStyle: {
      backgroundColor: background ? `${background}CC` : undefined,
    },
    valueStyle: { color: foreground },
    titleStyle: { color: secondary },
    descriptionStyle: { color: secondary, opacity: 0.7 },
    iconStyle: {
      color: iconColor,
      backgroundColor: iconColor ? `${iconColor}20` : undefined,
    },
  };
}
export function createIconStatRegistry(
  options: Readonly<IconStatRegistryOptions>,
) {
  const engine = options.templateEngine ?? createTemplateEngine();
  function RegisteredIconStat({
    widget,
    editMode,
  }: Readonly<WidgetComponentProps>) {
    const config = widget.config;
    const fields = useMemo(
      () => ({
        title: templateField(config.title, options.defaultTitle),
        value: templateField(config.value, "0"),
        unit: templateField(config.unit, ""),
        subtitle: templateField(config.subtitle, ""),
        goToUrl: templateField(config.goToUrl, ""),
      }),
      [
        config.title,
        config.value,
        config.unit,
        config.subtitle,
        config.goToUrl,
      ],
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
    if (status === "loading") return <output>{options.loadingLabel}</output>;
    if (status === "error") return <p role="alert">{options.errorLabel}</p>;
    if (status === "unsupported")
      return <p role="alert">{options.unsupportedDataLabel}</p>;
    const parsed = Number(resolved.value);
    const value = Number.isFinite(parsed) ? parsed : 0;
    const matched = evaluateColorRulesGeneric(rules, String(value), [
      ...targets,
    ]);
    const styles = presentationStyles(config, matched);
    const subtitle = resolved.subtitle ?? "";
    const iconName = typeof config.icon === "string" ? config.icon : "cart";
    const icon =
      config.showIcon === false ? undefined : options.renderIcon?.(iconName);
    const scalable = config.expandable === true;
    const content = (
      <IconStat
        title={resolved.title}
        value={options.formatValue?.(value) ?? String(value)}
        unit={resolved.unit}
        description={options.renderDescription?.(subtitle) ?? subtitle}
        icon={icon}
        variant={config.cardVariant === "vertical" ? "vertical" : "horizontal"}
        scalable={scalable}
        {...styles}
      />
    );
    const href =
      config.showGoTo === true && !editMode
        ? destination(resolved.goToUrl)
        : undefined;
    const style = {
      height: "100%",
      width: "100%",
      containerType: scalable ? "size" : undefined,
    };
    return href ? (
      <a className="miot-icon-stat-link" href={href} style={style}>
        {content}
      </a>
    ) : (
      <div style={style}>{content}</div>
    );
  }
  return createWidgetRegistry([
    {
      meta: { id: "stat_icon", hasChildren: false, hasSettings: false },
      Component: RegisteredIconStat,
      getLayoutDefaults: () => ({ minW: 3, minH: 1 }),
    },
  ]);
}
