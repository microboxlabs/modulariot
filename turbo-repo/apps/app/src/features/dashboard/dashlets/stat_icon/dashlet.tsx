"use client";

import { useState, useEffect } from "react";
import type { IconType } from "react-icons";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import { PgrestDashletFields, useDashletPgrest } from "../common/use-dashlet-pgrest";
import {
  DashletLoading,
  DashletError,
  parseResolvedNumber,
} from "../common/dashlet-states";
import { DASHLET_ICON_OPTIONS } from "../common/icon-options";
import { ICON_REGISTRY } from "@/features/common/components/icon-picker-dropdown/icon-registry";
import {
  evaluateColorRulesGeneric,
  buildIconStyle,
  buildBgStyle,
} from "../common/color-rule-evaluation";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import type { ThresholdConfig } from "../common/threshold-types";
import { KpiStat } from "@/features/common/components/kpi-stat";
import type {
  ValueColorRulesConfig,
  ValueColorRule,
} from "./value-color-rules";
import { normalizeValueColorRulesConfig } from "./value-color-rules";

// ============================================================================
// Configuration Types
// ============================================================================

export type CardVariant = "horizontal" | "vertical";

export interface DashletConfig extends PgrestDashletFields {
  title: string;
  value: string;
  unit: string;
  subtitle: string;
  /** Layout variant: horizontal (icon left) or vertical (stacked) */
  cardVariant?: CardVariant;
  /** Whether to show the icon */
  showIcon?: boolean;
  icon?: string;
  /** Icon color (hex without #) */
  iconColor?: string;
  /** Whether to use custom background color */
  showBgColor?: boolean;
  /** Card background color (hex without #) */
  bgColor?: string;
  /** Whether to use custom value text color */
  showValueColor?: boolean;
  /** Primary value text color (hex without #) */
  valueColor?: string;
  /** Whether to use custom secondary text color */
  showSecondaryColor?: boolean;
  /** Secondary text color for title/description (hex without #) */
  secondaryColor?: string;
  /** Whether to scale text and icons based on container size */
  expandable?: boolean;
  thresholds?: ThresholdConfig;
  /** Whether to enable navigation on click */
  showGoTo?: boolean;
  /** URL path to navigate to (e.g., "/app/es/home/testing?param=1#anchor") */
  goToUrl?: string;
  /** Value-based color rules for text and background */
  valueColorRules?: ValueColorRulesConfig;
}

export const defaultConfig: DashletConfig = {
  title: "{{row.title}}",
  value: "{{row.value}}",
  unit: "{{row.unit}}",
  subtitle: "{{row.value}} {{row.unit}}",
  staticData: '{\n  "title": "Orders",\n  "value": "156",\n  "unit": "items"\n}',
  cardVariant: "horizontal",
  showIcon: true,
  icon: "cart",
  iconColor: "3b82f6",
  showBgColor: false,
  bgColor: "3b82f6",
  showValueColor: false,
  valueColor: "1f2937",
  showSecondaryColor: false,
  secondaryColor: "6b7280",
  expandable: false,
  showGoTo: false,
  goToUrl: "",
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 1,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

const FIELD_DEFAULTS: Record<string, string> = {
  title: "",
  value: "0",
  unit: "",
  subtitle: "",
  goToUrl: "",
};

/** Resolves an icon key from both the legacy DASHLET_ICON_OPTIONS and the new ICON_REGISTRY. */
function useIconFromKey(key: string | undefined): IconType | undefined {
  // Legacy keys resolve synchronously
  const legacyIcon = key
    ? (DASHLET_ICON_OPTIONS.find((opt) => opt.value === key)?.icon as IconType | undefined)
    : undefined;

  const [registryIcon, setRegistryIcon] = useState<IconType | undefined>(undefined);

  useEffect(() => {
    if (!key || legacyIcon) {
      setRegistryIcon(undefined);
      return;
    }
    const entry = ICON_REGISTRY[key];
    if (!entry) return;
    let cancelled = false;
    entry
      .load()
      .then((mod) => {
        if (!cancelled) setRegistryIcon(() => mod.default as unknown as IconType);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key, legacyIcon]);

  return legacyIcon ?? registryIcon;
}

// ============================================================================
// Color Rules Helpers
// ============================================================================

const TARGET_KEYS = ["text", "bg", "icon"] as const;
type TargetKey = (typeof TARGET_KEYS)[number];

function evaluateColorRules(
  rules: ValueColorRule[],
  evalValue: string
): {
  textColor: string | undefined;
  bgColor: string | undefined;
  iconColor: string | undefined;
} {
  const colors = evaluateColorRulesGeneric<TargetKey, ValueColorRule>(
    rules,
    evalValue,
    [...TARGET_KEYS]
  );
  return {
    textColor: colors.text,
    bgColor: colors.bg,
    iconColor: colors.icon,
  };
}

/** Build value text style from rule color, manual setting, or undefined */
function buildValueStyle(
  ruleTextColor: string | undefined,
  showValueColor: boolean,
  valueColorHex: string
): React.CSSProperties | undefined {
  if (ruleTextColor) return { color: `#${ruleTextColor}` };
  if (showValueColor) return { color: `#${valueColorHex}` };
  return undefined;
}

/** Normalize a URL: prepend "/" only for relative paths (no scheme, not protocol-relative, not absolute) */
function normalizeGoToUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  // Check for valid URL scheme (letter followed by letters/digits/+/./- then colon)
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  const isProtocolRelative = trimmed.startsWith("//");
  const isAbsolutePath = trimmed.startsWith("/");
  if (hasScheme || isProtocolRelative || isAbsolutePath) return trimmed;
  return `/${trimmed}`;
}

/** Common KpiStat props builder */
interface KpiStatPropsInput {
  iconConfig: { icon: IconType; style: React.CSSProperties } | undefined;
  titleConfig: { text: string; style?: React.CSSProperties } | undefined;
  value: string | number;
  valueStyle: React.CSSProperties | undefined;
  unit: string;
  descriptionConfig: { text: string; style: React.CSSProperties } | undefined;
  cardVariant: CardVariant;
  bgStyle: React.CSSProperties | undefined;
}

function buildKpiStatProps(input: KpiStatPropsInput) {
  return {
    icon: input.iconConfig,
    title: input.titleConfig,
    value: { text: String(input.value), style: input.valueStyle },
    unit: input.unit,
    description: input.descriptionConfig,
    variant: input.cardVariant,
    containerStyle: input.bgStyle,
  };
}

// ============================================================================
// Component - Stat Card
// ============================================================================

/**
 * Stat Card - Configurable KPI display with multiple visual styles
 * Supports: default, gradient colors, minimal, bordered layouts
 */
export function Dashlet({ widget, editMode }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);

  const { resolved, loading, fetchError } = useDashletPgrest(
    config,
    FIELD_DEFAULTS,
    refreshIntervalMs
  );

  const iconKey = config.icon ?? "cart";
  const IconComponent = useIconFromKey(iconKey);

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const title = resolved.title ?? "";
  const unit = resolved.unit ?? "";
  const subtitle = resolved.subtitle ?? "";
  const value = parseResolvedNumber(resolved.value);

  const cardVariant: CardVariant = config.cardVariant ?? "horizontal";
  const showIcon = config.showIcon !== false;
  const iconColorHex = config.iconColor ?? "3b82f6";
  const showBgColor = config.showBgColor === true;
  const bgColorHex = config.bgColor ?? "3b82f6";
  const showValueColor = config.showValueColor === true;
  const valueColorHex = config.valueColor ?? "1f2937";
  const showSecondaryColor = config.showSecondaryColor === true;
  const secondaryColorHex = config.secondaryColor ?? "6b7280";
  const expandable = config.expandable === true;
  const showGoTo = config.showGoTo === true;
  const goToUrl = normalizeGoToUrl(resolved.goToUrl ?? "");
  const hasGoToLink = showGoTo && goToUrl.length > 0;

  // Evaluate value color rules
  const valueColorRulesConfig = normalizeValueColorRulesConfig(
    config.valueColorRules
  );

  const {
    textColor: ruleTextColor,
    bgColor: ruleBgColor,
    iconColor: ruleIconColor,
  } = valueColorRulesConfig.rules.length > 0
    ? evaluateColorRules(valueColorRulesConfig.rules, String(value))
    : { textColor: undefined, bgColor: undefined, iconColor: undefined };

  // Build icon config: show icon with selected color, or undefined if hidden
  const iconConfig =
    showIcon && IconComponent
      ? {
          icon: IconComponent,
          style: buildIconStyle(ruleIconColor, iconColorHex),
        }
      : undefined;

  // Build inline style for custom background color (80% opacity)
  const bgStyle = buildBgStyle(ruleBgColor, showBgColor, bgColorHex);

  // Build text styles (rule color takes priority over manual setting)
  const valueStyle = buildValueStyle(
    ruleTextColor,
    showValueColor,
    valueColorHex
  );
  const titleStyle = showSecondaryColor
    ? { color: `#${secondaryColorHex}` }
    : undefined;
  const descriptionStyle = showSecondaryColor
    ? { color: `#${secondaryColorHex}`, opacity: 0.7 }
    : { opacity: 0.7 };

  // Only show title/description if they have content
  const titleConfig = title.trim()
    ? { text: title, style: titleStyle }
    : undefined;
  const descriptionConfig = subtitle.trim()
    ? { text: subtitle, style: descriptionStyle, markdown: true }
    : undefined;

  // Build common KpiStat props
  const kpiProps = buildKpiStatProps({
    iconConfig,
    titleConfig,
    value,
    valueStyle,
    unit,
    descriptionConfig,
    cardVariant,
    bgStyle,
  });

  // Interactive hover classes for KpiStat when goTo is enabled
  const interactiveClasses = hasGoToLink
    ? "cursor-pointer transition-colors duration-200 hover:border-primary-500"
    : "";

  // Render based on expandable and goTo settings
  return renderStatCard(
    expandable,
    hasGoToLink && !editMode,
    goToUrl,
    kpiProps,
    interactiveClasses
  );
}

/** Render the stat card with appropriate wrapper based on settings */
function renderStatCard(
  expandable: boolean,
  hasGoToLink: boolean,
  goToUrl: string,
  kpiProps: ReturnType<typeof buildKpiStatProps>,
  interactiveClasses: string
): React.ReactNode {
  if (expandable && hasGoToLink) {
    return (
      <a
        href={goToUrl}
        className="block h-full w-full"
        style={{ containerType: "size" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <KpiStat
          {...kpiProps}
          className={`h-full ${interactiveClasses}`}
          scalable
        />
      </a>
    );
  }

  if (expandable) {
    return (
      <div className="h-full w-full" style={{ containerType: "size" }}>
        <KpiStat {...kpiProps} className="h-full" scalable />
      </div>
    );
  }

  if (hasGoToLink) {
    return (
      <a
        href={goToUrl}
        className="block h-full w-full"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <KpiStat
          {...kpiProps}
          className={`h-full text-2xl ${interactiveClasses}`}
        />
      </a>
    );
  }

  return <KpiStat {...kpiProps} className="h-full text-2xl" />;
}
