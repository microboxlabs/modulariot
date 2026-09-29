"use client";

import { useMemo } from "react";
import { TextCard } from "@microboxlabs/miot-dashboard-ui/react";
import "@microboxlabs/miot-dashboard-ui/styles.css";
import type {
  DashletComponentProps,
  DashletLayoutDefaults,
  DataProviderEntry,
} from "../types";
import { type PgrestDashletFields } from "../common/use-dashlet-pgrest";
import { useHybridPgrestContext } from "../common/use-dashlet-pgrest";
import { DashletLoading, DashletError } from "../common/dashlet-states";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { resolveHandlebarsField } from "../common/use-handlebars-templates";

// ============================================================================
// Configuration Types
// ============================================================================

export type TextAlign = "left" | "center" | "right";

export interface DashletConfig extends PgrestDashletFields {
  text: string;
  italic: boolean;
  align: TextAlign;
  dataProvider?: DataProviderEntry[];
}

export const defaultConfig: DashletConfig = {
  text: "Add your text or quote here...",
  italic: true,
  align: "left",
  dataProvider: [],
};

// ============================================================================
// Layout Defaults
// ============================================================================

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 4,
  minH: 1,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Component
// ============================================================================

const EMPTY_DATA_PROVIDER: DataProviderEntry[] = [];

export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const {
    text = defaultConfig.text,
    italic = defaultConfig.italic,
    align = defaultConfig.align,
    dataProvider = EMPTY_DATA_PROVIDER,
  } = config;

  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);

  const { templateContext, loading, fetchError } = useHybridPgrestContext(
    config,
    dataProvider,
    refreshIntervalMs
  );

  const compiledText = useMemo(
    () => resolveHandlebarsField(text, templateContext),
    [text, templateContext]
  );

  if (loading) return <DashletLoading />;
  if (fetchError) return <DashletError message={fetchError} />;
  return <TextCard text={compiledText} italic={italic} align={align} />;
}
