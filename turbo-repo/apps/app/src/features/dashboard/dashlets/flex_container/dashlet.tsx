"use client";

import React, { useMemo } from "react";
import Markdown from "react-markdown";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";

// ============================================================================
// Types
// ============================================================================

export type FlexLayout = "row" | "column" | "grid";

export interface DashletConfig {
  layout: FlexLayout;
  title?: string;
  description?: string;
}

export const defaultConfig: DashletConfig = {
  layout: "row",
  title: "Untitled",
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
  const config = (widget.config as unknown as DashletConfig) ?? defaultConfig;
  const layout = config.layout ?? "row";
  const title = config.title?.trim() || "Untitled";
  const description = config.description?.trim() || "";
  const widgetChildren = useMemo(() => widget.children ?? [], [widget.children]);
  const hasChildren = widgetChildren.length > 0;

  const containerStyle = useMemo((): React.CSSProperties => {
    if (layout === "column") {
      return {
        display: "flex",
        flexDirection: "column",
        gap: 8,
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        alignItems: "stretch",
      };
    }
    if (layout === "grid") {
      return {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        alignContent: "flex-start",
      };
    }
    // row
    return {
      display: "flex",
      flexDirection: "row",
      gap: 8,
      height: "100%",
      overflowX: "auto",
      overflowY: "hidden",
      alignItems: "stretch",
    };
  }, [layout]);

  const wrappedChildren = useMemo(() => {
    if (!children) return null;
    return React.Children.map(children, (child, index) => {
      const key = widgetChildren[index]?.id ?? index;
      let itemStyle: React.CSSProperties;
      if (layout === "column") {
        itemStyle = { flex: "1 1 0", width: "100%", minWidth: 0, minHeight: 0 };
      } else if (layout === "grid") {
        itemStyle = { flex: "1 1 auto", minWidth: 0, minHeight: 0 };
      } else {
        itemStyle = { flex: "1 1 0", height: "100%", minWidth: 0, minHeight: 0, overflow: "hidden" };
      }

      return (
        <div key={key} style={itemStyle}>
          {child}
        </div>
      );
    });
  }, [children, widgetChildren, layout]);

  return (
    <div className="flex flex-col h-full rounded-lg ring-1 ring-gray-200 bg-white shadow-sm dark:ring-gray-700 dark:bg-gray-800">
      <div className="shrink-0 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        {description && (
          <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 prose prose-xs dark:prose-invert max-w-none">
            <Markdown>{description}</Markdown>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 p-2 overflow-hidden">
        {!hasChildren && !editMode ? (
          <div className="flex h-full flex-col items-center justify-center text-gray-400 dark:text-gray-500">
            <p className="text-sm">No widgets yet</p>
          </div>
        ) : (
          <div style={containerStyle}>{wrappedChildren}</div>
        )}
      </div>
    </div>
  );
}
