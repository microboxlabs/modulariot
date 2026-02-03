"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { HiPlus } from "react-icons/hi2";
import {
  GridLayout,
  verticalCompactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import type { DashletComponentProps } from "../types";
import type { GridLayoutItem } from "../../types/dashboard.types";
import { useDashboard } from "../../context/dashboard-context";
import { getWidgetDefaults } from "../../utils/widget-defaults";

import "react-grid-layout/css/styles.css";

/** Configuration for labeled container */
export interface LabeledContainerConfig {
  label: string;
}

/**
 * Labeled Container Dashlet
 * A bordered group with a fieldset-legend style label that cuts into the border
 */
export function LabeledContainer({
  widget,
  editMode,
  isRoot,
  onAddChild,
  children,
}: DashletComponentProps) {
  const config = widget.config as unknown as LabeledContainerConfig;
  const label = config.label || "Group";
  const widgetChildren = widget.children ?? [];
  const hasChildren = widgetChildren.length > 0;
  const { updateWidgetLayouts } = useDashboard();

  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(container);
    setContainerWidth(container.offsetWidth);

    return () => resizeObserver.disconnect();
  }, []);

  // Convert children to react-grid-layout format
  const layout: Layout = useMemo(
    () =>
      widgetChildren.map((child, index) => {
        const defaults = getWidgetDefaults(child.componentId);
        return {
          i: child.id,
          x: child.layout?.x ?? index % 12,
          y: child.layout?.y ?? Math.floor(index / 12),
          w: child.layout?.w ?? defaults.minW,
          h: child.layout?.h ?? defaults.minH,
          isDraggable: editMode,
          isResizable: editMode,
          minW: child.layout?.minW ?? defaults.minW,
          maxW: child.layout?.maxW ?? 12,
          minH: child.layout?.minH ?? defaults.minH,
          maxH: child.layout?.maxH ?? Infinity,
        };
      }),
    [widgetChildren, editMode]
  );

  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      if (!editMode) return;
      const items: GridLayoutItem[] = newLayout.map((item: LayoutItem) => {
        // Find existing child to preserve min/max values
        const existingChild = widgetChildren.find((c) => c.id === item.i);
        return {
          i: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          minW: existingChild?.layout?.minW,
          minH: existingChild?.layout?.minH,
          maxW: existingChild?.layout?.maxW,
          maxH: existingChild?.layout?.maxH,
        };
      });
      updateWidgetLayouts(widget.id, items);
    },
    [widget.id, updateWidgetLayouts, editMode, widgetChildren]
  );

  // Background color depends on context: gray-50 at root, white inside containers
  const labelBgClass = isRoot
    ? "bg-gray-50 dark:bg-gray-900"
    : "bg-white dark:bg-gray-800";

  return (
    <div
      className={`relative flex flex-col rounded-lg border border-gray-200 px-4 pb-2 pt-5 dark:border-gray-700 ${
        editMode ? "h-full" : ""
      }`}
    >
      {/* Label that cuts into border (fieldset-legend style) */}
      <span
        className={`absolute -top-3 left-3 z-10 px-2 text-sm font-medium text-gray-500 dark:text-gray-400 ${labelBgClass}`}
      >
        {label}
      </span>

      {/* Children content with grid layout */}
      <div
        ref={containerRef}
        className={`flex flex-col ${
          editMode ? "min-h-0 flex-1 overflow-auto" : ""
        }`}
      >
        {hasChildren ? (
          containerWidth > 0 ? (
            <div className="nested-grid-wrapper">
              <GridLayout
                className="labeled-container-grid"
                layout={layout}
                width={containerWidth}
                gridConfig={{
                  cols: 12,
                  rowHeight: 40,
                  margin: [8, 8] as const,
                  containerPadding: [0, 0] as const,
                  maxRows: Infinity,
                }}
                dragConfig={{
                  enabled: editMode,
                  cancel: ".no-drag",
                }}
                resizeConfig={{
                  enabled: editMode,
                  handles: ["e", "s", "se"],
                }}
                compactor={verticalCompactor}
                onLayoutChange={handleLayoutChange}
                autoSize={true}
              >
                {children}
              </GridLayout>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-gray-400">
              <p className="text-sm">Measuring...</p>
            </div>
          )
        ) : (
          !editMode && (
            <div className="flex flex-1 items-center justify-center text-gray-400 dark:text-gray-500">
              <p className="text-sm">Empty group</p>
            </div>
          )
        )}
      </div>

      {/* Add widget button - always visible at bottom */}
      {editMode && (
        <button
          type="button"
          onClick={() => onAddChild?.("card")}
          className="no-drag mx-2 mt-2 flex shrink-0 items-center justify-center gap-1 rounded border border-dashed border-gray-300 py-2 text-xs text-gray-500 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-blue-500 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <HiPlus className="h-3 w-3" />
          <span>Add</span>
        </button>
      )}

      {/* Custom styles for labeled container grid */}
      <style jsx global>{`
        .labeled-container-grid {
          user-select: none;
          -webkit-user-select: none;
        }
        .labeled-container-grid .react-grid-item {
          user-select: none;
          -webkit-user-select: none;
        }
        .labeled-container-grid .react-grid-item.react-grid-placeholder {
          background: rgba(59, 130, 246, 0.08) !important;
          border-radius: 0.5rem;
          border: 2px dashed rgba(59, 130, 246, 0.4) !important;
          opacity: 1 !important;
        }
        .labeled-container-grid .react-grid-item.react-draggable-dragging {
          z-index: 100;
          opacity: 0.9;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          user-select: none;
          -webkit-user-select: none;
        }

        /* Hide all resize handles by default */
        .labeled-container-grid .react-grid-item > .react-resizable-handle {
          background: none !important;
          opacity: 0;
          transition: opacity 0.15s ease;
          transform: none !important;
        }
        .labeled-container-grid
          .react-grid-item
          > .react-resizable-handle::after {
          transform: none !important;
        }

        /* Show handles on hover */
        .labeled-container-grid
          .react-grid-item:hover
          > .react-resizable-handle {
          opacity: 1;
        }

        /* East (right) handle */
        .labeled-container-grid .react-grid-item > .react-resizable-handle-e {
          width: 6px !important;
          height: 100% !important;
          right: 0 !important;
          top: 0 !important;
          cursor: ew-resize;
        }
        .labeled-container-grid
          .react-grid-item
          > .react-resizable-handle-e::after {
          content: "";
          position: absolute;
          right: 2px;
          top: 50%;
          transform: translateY(-50%) !important;
          width: 2px;
          height: 24px;
          background: rgba(156, 163, 175, 0.35);
          border-radius: 1px;
          border: none !important;
        }

        /* South (bottom) handle */
        .labeled-container-grid .react-grid-item > .react-resizable-handle-s {
          height: 6px !important;
          width: 100% !important;
          bottom: 0 !important;
          left: 0 !important;
          cursor: ns-resize;
        }
        .labeled-container-grid
          .react-grid-item
          > .react-resizable-handle-s::after {
          content: "";
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%) !important;
          height: 2px;
          width: 24px;
          background: rgba(156, 163, 175, 0.35);
          border-radius: 1px;
          border: none !important;
        }

        /* Southeast corner handle */
        .labeled-container-grid .react-grid-item > .react-resizable-handle-se {
          width: 14px !important;
          height: 14px !important;
          right: 0 !important;
          bottom: 0 !important;
          cursor: nwse-resize;
        }
        .labeled-container-grid
          .react-grid-item
          > .react-resizable-handle-se::after {
          content: "";
          position: absolute;
          right: 3px;
          bottom: 3px;
          width: 6px;
          height: 6px;
          border-right: 2px solid rgba(156, 163, 175, 0.35);
          border-bottom: 2px solid rgba(156, 163, 175, 0.35);
          border-radius: 0 0 2px 0;
          background: none !important;
          transform: none !important;
        }
      `}</style>
    </div>
  );
}

export const defaultConfig: LabeledContainerConfig = {
  label: "Group",
};
