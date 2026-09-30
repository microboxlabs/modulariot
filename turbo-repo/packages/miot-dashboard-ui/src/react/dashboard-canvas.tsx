"use client";

import { useCallback } from "react";
import type { Widget } from "@microboxlabs/miot-dashboard-contract/document";
import { DashboardGrid, type DashboardGridProps } from "./dashboard-grid";
import {
  WidgetRenderer,
  type WidgetRendererProps,
  type RenderableWidget,
} from "./widget-renderer";

export interface DashboardCanvasProps {
  widgets: readonly Widget[];
  registry: {
    get(id: string):
      | (RenderableWidget & {
          getLayoutDefaults(config: Widget["config"]): {
            minW?: number;
            minH?: number;
          };
        })
      | undefined;
  };
  unknownWidgetLabel: string;
  /** Host derives edit intent from current server permissions; default is read-only. */
  editMode?: boolean;
  onLayoutCommit?: NonNullable<DashboardGridProps["onLayoutCommit"]>;
  onAction?: NonNullable<WidgetRendererProps["onAction"]>;
  Frame?: NonNullable<WidgetRendererProps["Frame"]>;
}

/** Complete root layout and recursive rendering with instance-owned widget DOM IDs. */
export function DashboardCanvas({
  widgets,
  registry,
  unknownWidgetLabel,
  editMode = false,
  onLayoutCommit,
  onAction,
  Frame,
}: Readonly<DashboardCanvasProps>) {
  const renderWidget = useCallback(
    (widget: Widget) => (
      <WidgetRenderer
        widget={widget}
        registry={registry}
        unknownWidgetLabel={unknownWidgetLabel}
        editMode={editMode}
        onAction={onAction}
        Frame={Frame}
        isRoot
      />
    ),
    [registry, unknownWidgetLabel, editMode, onAction, Frame],
  );
  return (
    <DashboardGrid
      widgets={widgets}
      registry={registry}
      renderWidget={renderWidget}
      editMode={editMode}
      onLayoutCommit={onLayoutCommit}
    />
  );
}
