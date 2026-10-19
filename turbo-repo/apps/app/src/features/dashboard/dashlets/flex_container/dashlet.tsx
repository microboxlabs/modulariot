"use client";

import { FlexContainer, type FlexLayout } from "@microboxlabs/miot-dashboard-ui/react";
import "@microboxlabs/miot-dashboard-ui/styles.css";
import Markdown from "react-markdown";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import { useOptionalDashboard } from "../../context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";

// ============================================================================
// Types
// ============================================================================

export type { FlexLayout } from "@microboxlabs/miot-dashboard-ui/react";

export interface DashletConfig {
  layout: FlexLayout;
  title?: string;
  description?: string;
}

export const defaultConfig: DashletConfig = {
  layout: "row",
  title: "",
  description: "",
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return { minW: 3, minH: 1 };
}

// ============================================================================
// Component
// ============================================================================

export function Dashlet({
  widget,
  editMode,
  children,
}: Readonly<DashletComponentProps>) {
  const { dictionary } = useOptionalDashboard();
  const config = (widget.config as unknown as DashletConfig) ?? defaultConfig;
  const title = config.title?.trim() || tr("dashboard.defaults.untitled", dictionary);
  const description = config.description?.trim() || "";
  return (
    <FlexContainer
      layout={config.layout ?? "row"}
      title={title}
      description={description ? (
        <div className="prose prose-xs dark:prose-invert max-w-none">
          <Markdown>{description}</Markdown>
        </div>
      ) : undefined}
      emptyLabel={tr("dashboard.defaults.noWidgetsYet", dictionary)}
      editMode={editMode}
    >
      {children}
    </FlexContainer>
  );
}
