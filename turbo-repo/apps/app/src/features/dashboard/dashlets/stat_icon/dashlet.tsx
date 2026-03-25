"use client";

import { HiShoppingCart } from "react-icons/hi2";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import type { PgrestDashletFields } from "../common";
import {
  useDashletPgrest,
  DashletLoading,
  DashletError,
  parseResolvedNumber,
} from "../common";
import { KpiStat } from "@/features/common/components/kpi-stat";

// ============================================================================
// Configuration Types
// ============================================================================

export interface DashletConfig extends PgrestDashletFields {
  title: string;
  value: string;
  unit: string;
  subtitle: string;
}

export const defaultConfig: DashletConfig = {
  title: "Orders",
  value: "156",
  unit: "",
  subtitle: "Last 24 hours",
};

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 3,
  minH: 2,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

const FIELD_DEFAULTS: Record<string, string> = {
  title: "Orders",
  value: "156",
  unit: "",
  subtitle: "Last 24 hours",
};

// ============================================================================
// Component - Style 4: Icon Accent
// ============================================================================

/**
 * Icon Accent Card - Large icon with accent color
 */
export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;

  const { resolved, loading, fetchError } = useDashletPgrest(
    config,
    FIELD_DEFAULTS
  );

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;

  const title = resolved.title || "Orders";
  const unit = resolved.unit ?? "";
  const subtitle = resolved.subtitle || "";
  const value = parseResolvedNumber(resolved.value);

  return (
    <KpiStat
      icon={{ icon: HiShoppingCart }}
      title={{ text: title }}
      value={{ text: value }}
      unit={unit}
      description={{ text: subtitle }}
      variant="horizontal"
      className="h-full text-2xl"
    />
  );
}
