"use client";

import { useMemo } from "react";
import { InfoCard } from "@microboxlabs/miot-dashboard-ui/react";
import "@microboxlabs/miot-dashboard-ui/styles.css";
import { tr } from "@/features/i18n/tr.service";
import { useOptionalDashboard } from "../../context/dashboard-context";
import {
  HiChartBar,
  HiCurrencyDollar,
  HiUsers,
  HiShoppingCart,
  HiClock,
  HiCheckCircle,
  HiInformationCircle,
  HiExclamationTriangle,
  HiCube,
  HiTruck,
  HiBolt,
} from "react-icons/hi2";
import type {
  DashletComponentProps,
  DashletLayoutDefaults,
  DataProviderEntry,
} from "../types";
import { type PgrestDashletFields } from "../common/use-dashlet-pgrest";
import { useHybridPgrestContext } from "../common/use-dashlet-pgrest";
import { DashletLoading, DashletError } from "../common/dashlet-states";
import { evaluateColorRulesGeneric } from "../common/color-rule-evaluation";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { resolveHandlebarsField } from "../common/use-handlebars-templates";
import type {
  ValueColorRulesConfig,
  ValueColorRule,
} from "./value-color-rules";
import { normalizeValueColorRulesConfig } from "./value-color-rules";

// ============================================================================
// Configuration Types
// ============================================================================

/** Available icons for the info card */
export type InfoCardIcon =
  | "chart"
  | "currency"
  | "users"
  | "cart"
  | "clock"
  | "check"
  | "info"
  | "warning"
  | "cube"
  | "truck"
  | "bolt";

/** Icon configuration with metadata */
export interface IconOption {
  id: InfoCardIcon;
  label: string;
  component: React.ComponentType<{ className?: string }>;
}

/** All available icon options for settings */
export const ICON_OPTIONS: IconOption[] = [
  { id: "chart", label: "Chart", component: HiChartBar },
  { id: "currency", label: "Currency", component: HiCurrencyDollar },
  { id: "users", label: "Users", component: HiUsers },
  { id: "cart", label: "Cart", component: HiShoppingCart },
  { id: "clock", label: "Clock", component: HiClock },
  { id: "check", label: "Check", component: HiCheckCircle },
  { id: "info", label: "Info", component: HiInformationCircle },
  { id: "warning", label: "Warning", component: HiExclamationTriangle },
  { id: "cube", label: "Cube", component: HiCube },
  { id: "truck", label: "Truck", component: HiTruck },
  { id: "bolt", label: "Bolt", component: HiBolt },
];

/** Icon components map */
const ICONS: Record<
  InfoCardIcon,
  React.ComponentType<{ className?: string }>
> = Object.fromEntries(
  ICON_OPTIONS.map((opt) => [opt.id, opt.component])
) as Record<InfoCardIcon, React.ComponentType<{ className?: string }>>;

/** Configuration for this dashlet */
export interface DashletConfig extends PgrestDashletFields {
  /** Title displayed in header (top-left) */
  title: string;
  /** Icon displayed in header (top-right) */
  icon: InfoCardIcon;
  /** Custom color for the icon (hex or CSS color) */
  iconColor?: string;
  /** Main value display (e.g., "100%", "42", "$1,234") */
  value: string;
  /** Custom color for the value text (hex or CSS color) */
  valueColor?: string;
  /** Description text below the value */
  descriptor: string;
  /** Custom color for the descriptor text (hex or CSS color) */
  descriptorColor?: string;
  /** AI-generated summary placeholder text */
  aiPlaceholder: string;
  /** Optional URL for "View more" button */
  viewMoreUrl: string;
  /** Configurable label for "View more" button */
  viewMoreLabel: string;
  /** Whether to open the "View more" link in the same tab instead of a new one */
  openInSameTab?: boolean;
  /** Data provider entries for dynamic values */
  dataProvider?: DataProviderEntry[];
  /** Color rules for value-based styling */
  valueColorRules?: ValueColorRulesConfig;
}

/** Default configuration */
export const defaultConfig: DashletConfig = {
  title: "Metric",
  icon: "chart",
  iconColor: "",
  value: "100%",
  valueColor: "",
  descriptor: "Percentage of tasks completed",
  descriptorColor: "",
  aiPlaceholder: "AI summary will appear here",
  viewMoreUrl: "",
  viewMoreLabel: "View more",
  dataProvider: [],
};

// ============================================================================
// Layout Defaults
// ============================================================================

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 4,
  minH: 4,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Color Rules Helpers
// ============================================================================

const TARGET_KEYS = ["text", "icon"] as const;
type TargetKey = (typeof TARGET_KEYS)[number];

function evaluateColorRules(
  rules: ValueColorRule[],
  evalValue: string
): { textColor: string | undefined; iconColor: string | undefined } {
  const colors = evaluateColorRulesGeneric<TargetKey, ValueColorRule>(
    rules,
    evalValue,
    [...TARGET_KEYS]
  );
  return {
    textColor: colors.text,
    iconColor: colors.icon,
  };
}

// ============================================================================
// Component
// ============================================================================

/**
 * Info Card Dashlet
 */
export function Dashlet({
  widget,
  editMode,
  onAddChild,
  children,
}: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const { dictionary } = useOptionalDashboard();
  const {
    title = defaultConfig.title,
    icon = defaultConfig.icon,
    iconColor = defaultConfig.iconColor,
    value = defaultConfig.value,
    valueColor = defaultConfig.valueColor,
    descriptor = defaultConfig.descriptor,
    descriptorColor = defaultConfig.descriptorColor,
    aiPlaceholder = defaultConfig.aiPlaceholder,
    viewMoreUrl = defaultConfig.viewMoreUrl,
    viewMoreLabel = defaultConfig.viewMoreLabel,
    dataProvider = [],
  } = config;

  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);

  const { templateContext, loading, fetchError } = useHybridPgrestContext(
    config,
    dataProvider,
    refreshIntervalMs
  );

  const compiledTitle = useMemo(
    () => resolveHandlebarsField(title, templateContext),
    [title, templateContext]
  );
  const compiledValue = useMemo(
    () => resolveHandlebarsField(value, templateContext),
    [value, templateContext]
  );
  const compiledDescriptor = useMemo(
    () => resolveHandlebarsField(descriptor, templateContext),
    [descriptor, templateContext]
  );
  const compiledAiPlaceholder = useMemo(
    () => resolveHandlebarsField(aiPlaceholder, templateContext),
    [aiPlaceholder, templateContext]
  );
  const compiledViewMoreUrl = useMemo(
    () => resolveHandlebarsField(viewMoreUrl, templateContext),
    [viewMoreUrl, templateContext]
  );
  const compiledViewMoreLabel = useMemo(
    () => resolveHandlebarsField(viewMoreLabel, templateContext),
    [viewMoreLabel, templateContext]
  );

  // ── Color rules support ────
  const colorRulesConfig = normalizeValueColorRulesConfig(
    config.valueColorRules
  );

  const { textColor: ruleTextColor, iconColor: ruleIconColor } =
    colorRulesConfig.rules.length > 0
      ? evaluateColorRules(colorRulesConfig.rules, compiledValue)
      : { textColor: undefined, iconColor: undefined };

  // Apply color rules or fallback to manual colors
  const effectiveValueColor = ruleTextColor
    ? `#${ruleTextColor}`
    : valueColor || undefined;

  const effectiveIconColor = ruleIconColor
    ? `#${ruleIconColor}`
    : iconColor || undefined;

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const IconComponent = Object.hasOwn(ICONS, icon) ? ICONS[icon] : ICONS.chart;
  const hasChildren = widget.children && widget.children.length > 0;

  return (
    <InfoCard
      title={compiledTitle}
      value={compiledValue}
      descriptor={compiledDescriptor}
      footer={compiledAiPlaceholder}
      icon={<IconComponent />}
      iconStyle={{ color: effectiveIconColor }}
      valueStyle={{ color: effectiveValueColor }}
      descriptorStyle={{ color: descriptorColor || undefined }}
      editMode={editMode}
      onAddDetail={onAddChild ? () => onAddChild("info_card") : undefined}
      addDetailLabel={tr("dashboard.settings.addDetail", dictionary)}
      viewMoreUrl={compiledViewMoreUrl}
      viewMoreLabel={
        compiledViewMoreLabel?.trim() || defaultConfig.viewMoreLabel
      }
      openInSameTab={config.openInSameTab}
    >
      {hasChildren ? children : undefined}
    </InfoCard>
  );
}
