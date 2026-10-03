"use client";
import { useMemo, type ReactNode } from "react";
import { createWidgetRegistry } from "../core/widget-registry";
import { evaluateColorRulesGeneric } from "../core/color-rule-evaluation";
import { createTemplateEngine } from "../templates";
import { InfoCard } from "./info-card";
import { normalizeTargetedColorRules } from "./targeted-color-rules";
import { templateField } from "./scalar-template-field";
import { useWidgetTemplateFields } from "./use-widget-template-fields";
import type { WidgetComponentProps } from "./widget-renderer";
import { templateStatusView } from "./widget-template-status";
export interface InfoCardRegistryOptions {
  defaultTitle: string;
  addDetailLabel: string;
  viewMoreLabel: string;
  loadingLabel: string;
  errorLabel: string;
  unsupportedDataLabel: string;
  renderIcon?: (name: string) => ReactNode;
  templateEngine?: ReturnType<typeof createTemplateEngine>;
}
const targets = ["text", "icon"] as const;
function manualColor(raw: unknown) {
  return typeof raw === "string" ? raw : undefined;
}
export function createInfoCardRegistry(
  options: Readonly<InfoCardRegistryOptions>,
) {
  const engine = options.templateEngine ?? createTemplateEngine();
  function RegisteredInfoCard({
    widget,
    editMode,
    onAddChild,
    children,
  }: Readonly<WidgetComponentProps>) {
    const config = widget.config;
    const fields = useMemo(
      () => ({
        title: templateField(config.title, options.defaultTitle),
        value: templateField(config.value, ""),
        descriptor: templateField(config.descriptor, ""),
        footer: templateField(config.aiPlaceholder, ""),
        href: templateField(config.viewMoreUrl, ""),
        linkLabel: templateField(config.viewMoreLabel, options.viewMoreLabel),
      }),
      [
        config.title,
        config.value,
        config.descriptor,
        config.aiPlaceholder,
        config.viewMoreUrl,
        config.viewMoreLabel,
      ],
    );
    const rules = useMemo(
      () => normalizeTargetedColorRules(config.valueColorRules, targets),
      [config.valueColorRules],
    );
    const { status, resolved } = useWidgetTemplateFields(
      config,
      fields,
      engine,
    );
    const pending = templateStatusView(status, options);
    if (pending) return pending;
    const colors = evaluateColorRulesGeneric(rules, resolved.value ?? "", [
      ...targets,
    ]);
    return (
      <InfoCard
        title={resolved.title || options.defaultTitle}
        value={resolved.value ?? ""}
        descriptor={resolved.descriptor ?? ""}
        footer={resolved.footer ?? ""}
        icon={options.renderIcon?.(templateField(config.icon, "chart"))}
        valueStyle={{
          color: colors.text
            ? `#${colors.text}`
            : manualColor(config.valueColor),
        }}
        iconStyle={{
          color: colors.icon
            ? `#${colors.icon}`
            : manualColor(config.iconColor),
        }}
        descriptorStyle={{ color: manualColor(config.descriptorColor) }}
        viewMoreUrl={resolved.href}
        viewMoreLabel={resolved.linkLabel?.trim() || options.viewMoreLabel}
        openInSameTab={config.openInSameTab === true}
        editMode={editMode}
        addDetailLabel={options.addDetailLabel}
        onAddDetail={onAddChild ? () => onAddChild("info_card") : undefined}
      >
        {widget.children?.length ? children : undefined}
      </InfoCard>
    );
  }
  return createWidgetRegistry([
    {
      meta: { id: "info_card", hasChildren: true, hasSettings: false },
      Component: RegisteredInfoCard,
      getLayoutDefaults: () => ({ minW: 4, minH: 4 }),
    },
  ]);
}
