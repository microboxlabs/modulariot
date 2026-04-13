"use client";

import type { IconType } from "react-icons";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import {
  PgrestDashletFields,
  useDashletPgrest,
  DashletLoading,
  DashletError,
  parseResolvedNumber,
  DASHLET_ICON_OPTIONS,
  type DashletIconKey,
} from "../common";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import type { ThresholdConfig } from "../common/threshold-types";
import { KpiStat } from "@/features/common/components/kpi-stat";

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
  /** Selected icon key */
  icon?: DashletIconKey;
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
}

export const defaultConfig: DashletConfig = {
  title: "Orders",
  value: "156",
  unit: "",
  subtitle: "Last 24 hours",
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
};

/** Get the icon component from the icon key */
function getIconFromKey(key: DashletIconKey | undefined): IconType | undefined {
  if (!key) return undefined;
  const found = DASHLET_ICON_OPTIONS.find((opt) => opt.value === key);
  // Cast to IconType since react-icons/hi2 icons are compatible
  return found?.icon as IconType | undefined;
}

// ============================================================================
// Component - Stat Card
// ============================================================================

/**
 * Stat Card - Configurable KPI display with multiple visual styles
 * Supports: default, gradient colors, minimal, bordered layouts
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);

  const { resolved, loading, fetchError } = useDashletPgrest(
    config,
    FIELD_DEFAULTS,
    refreshIntervalMs
  );

  /*
    const { color: thresholdColor, appliesTo } = useRowThreshold(
      config.thresholds,
      firstRow
    );
  */

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const title = resolved.title ?? "";
  const unit = resolved.unit ?? "";
  const subtitle = resolved.subtitle ?? "";
  const value = parseResolvedNumber(resolved.value);

  const cardVariant: CardVariant = config.cardVariant ?? "horizontal";
  const showIcon = config.showIcon !== false;
  const iconKey = config.icon ?? "cart";
  const iconColorHex = config.iconColor ?? "3b82f6";
  const showBgColor = config.showBgColor === true;
  const bgColorHex = config.bgColor ?? "3b82f6";
  const showValueColor = config.showValueColor === true;
  const valueColorHex = config.valueColor ?? "1f2937";
  const showSecondaryColor = config.showSecondaryColor === true;
  const secondaryColorHex = config.secondaryColor ?? "6b7280";
  const expandable = config.expandable === true;
  const IconComponent = getIconFromKey(iconKey);

  // Build icon config: show icon with selected color, or undefined if hidden
  const iconConfig =
    showIcon && IconComponent
      ? {
          icon: IconComponent,
          style: {
            backgroundColor: `#${iconColorHex}20`,
            color: `#${iconColorHex}`,
          },
        }
      : undefined;

  // Build inline style for custom background color (80% opacity)
  const bgStyle = showBgColor
    ? { backgroundColor: `#${bgColorHex}CC` }
    : undefined;

  // Build text styles (only apply custom color when checkbox is on)
  const valueStyle = showValueColor
    ? { color: `#${valueColorHex}` }
    : undefined;
  const titleStyle = showSecondaryColor
    ? { color: `#${secondaryColorHex}` }
    : undefined;
  // Description always has reduced opacity, with optional color
  const descriptionStyle = showSecondaryColor
    ? { color: `#${secondaryColorHex}`, opacity: 0.7 }
    : { opacity: 0.7 };

  // Only show title/description if they have content
  const titleConfig = title.trim()
    ? { text: title, style: titleStyle }
    : undefined;
  const descriptionConfig = subtitle.trim()
    ? { text: subtitle, style: descriptionStyle }
    : undefined;

  if (expandable) {
    return (
      <div className="h-full w-full" style={{ containerType: "size" }}>
        <KpiStat
          icon={iconConfig}
          title={titleConfig}
          value={{ text: value, style: valueStyle }}
          unit={unit}
          description={descriptionConfig}
          variant={cardVariant}
          className="h-full"
          containerStyle={bgStyle}
          scalable
        />
      </div>
    );
  }

  return (
    <KpiStat
      icon={iconConfig}
      title={titleConfig}
      value={{ text: value, style: valueStyle }}
      unit={unit}
      description={descriptionConfig}
      variant={cardVariant}
      className="h-full text-2xl"
      containerStyle={bgStyle}
    />
  );
}
