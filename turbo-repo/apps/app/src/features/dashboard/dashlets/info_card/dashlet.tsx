"use client";

import { useMemo } from "react";
import { Button } from "flowbite-react";
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
import type { DashletComponentProps, DashletLayoutDefaults, DataProviderEntry } from "../types";
import type { PgrestDashletFields } from "../common";
import { useHybridPgrestContext, DashletLoading, DashletError } from "../common";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { resolveHandlebarsField } from "../common/use-handlebars-templates";

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
  /** Main value display (e.g., "100%", "42", "$1,234") */
  value: string;
  /** Description text below the value */
  descriptor: string;
  /** AI-generated summary placeholder text */
  aiPlaceholder: string;
  /** Optional URL for "View more" button */
  viewMoreUrl: string;
  /** Whether to open the "View more" link in the same tab instead of a new one */
  openInSameTab?: boolean;
  /** Data provider entries for dynamic values */
  dataProvider?: DataProviderEntry[];
}

/** Default configuration */
export const defaultConfig: DashletConfig = {
  title: "Metric",
  icon: "chart",
  value: "100%",
  descriptor: "Percentage of tasks completed",
  aiPlaceholder: "AI summary will appear here",
  viewMoreUrl: "",
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
  const {
    title = defaultConfig.title,
    icon = defaultConfig.icon,
    value = defaultConfig.value,
    descriptor = defaultConfig.descriptor,
    aiPlaceholder = defaultConfig.aiPlaceholder,
    viewMoreUrl = defaultConfig.viewMoreUrl,
    dataProvider = [],
  } = config;

  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);

  const { templateContext, loading, fetchError } = useHybridPgrestContext(config, dataProvider, refreshIntervalMs);

  const compiledTitle = useMemo(() => resolveHandlebarsField(title, templateContext), [title, templateContext]);
  const compiledValue = useMemo(() => resolveHandlebarsField(value, templateContext), [value, templateContext]);
  const compiledDescriptor = useMemo(() => resolveHandlebarsField(descriptor, templateContext), [descriptor, templateContext]);
  const compiledAiPlaceholder = useMemo(() => resolveHandlebarsField(aiPlaceholder, templateContext), [aiPlaceholder, templateContext]);
  const compiledViewMoreUrl = useMemo(() => resolveHandlebarsField(viewMoreUrl, templateContext), [viewMoreUrl, templateContext]);

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const IconComponent = ICONS[icon] || ICONS.chart;
  const hasChildren = widget.children && widget.children.length > 0;

  const handleViewMore = () => {
    if (compiledViewMoreUrl) {
      try {
        const url = new URL(compiledViewMoreUrl, globalThis.location.href);
        if (url.protocol === "http:" || url.protocol === "https:") {
          if (config.openInSameTab) {
            globalThis.location.href = url.href;
          } else {
            globalThis.open(compiledViewMoreUrl, "_blank", "noopener,noreferrer");
          }
        }
      } catch {
        // Invalid URL, do nothing
      }
    }
  };

  const handleAddChild = () => {
    onAddChild?.("info_card");
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header: Title + Icon */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          {compiledTitle}
        </h3>
        <IconComponent className="h-5 w-5 text-gray-500 dark:text-gray-400" />
      </div>

      {/* Body: Value + Descriptor + Children */}
      <div className="flex flex-1 flex-col justify-center px-4 py-4">
        <p className="text-3xl font-bold text-gray-900 dark:text-white">
          {compiledValue}
        </p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {compiledDescriptor}
        </p>

        {/* Children: Inline nested dashlets */}
        {hasChildren && (
          <div className="mt-3 flex flex-col gap-2">{children}</div>
        )}

        {/* Add child button in edit mode */}
        {editMode && !hasChildren && (
          <button
            type="button"
            onClick={handleAddChild}
            className="no-drag mt-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-2 text-sm text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-600 dark:border-gray-600 dark:hover:border-gray-500"
          >
            <span>+ Add detail</span>
          </button>
        )}
      </div>

      {/* Footer: AI placeholder + View more button */}
      <div className="flex items-center justify-between gap-4 border-t border-gray-100 px-4 py-3 dark:border-gray-700">
        <p className="text-xs italic text-gray-400 dark:text-gray-500">
          {compiledAiPlaceholder}
        </p>
        {compiledViewMoreUrl && (
          <Button
            color="alternative"
            size="xs"
            onClick={handleViewMore}
            className="no-drag shrink-0"
          >
            View more
          </Button>
        )}
      </div>
    </div>
  );
}
