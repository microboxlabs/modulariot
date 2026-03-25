"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Button, ToggleSwitch } from "flowbite-react";
import { HiPlus } from "react-icons/hi2";
import {
  GridLayout,
  verticalCompactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import { useDashboard } from "../../context/dashboard-context";
import { EmptyState } from "../empty-state";
import { WidgetRenderer } from "../widget-renderer";
import { AddWidgetModal } from "../add-widget-modal/add-widget-modal";
import { getDashlet } from "../../dashlets";
import { GRID_COLS, type GridLayoutItem } from "../../types/dashboard.types";
import { DashboardSettingsDropdown } from "../dashboard-settings-dropdown";
import { DashboardFilterBar } from "../dashboard-filter-bar";

import "react-grid-layout/css/styles.css";

/**
 * Main dashboard view component
 * Renders all root-level widgets with edit mode controls using react-grid-layout
 */
export function DashboardView() {
  const {
    widgets,
    editMode,
    isLoaded,
    dashboardName,
    toggleEditMode,
    updateWidgetLayouts,
  } = useDashboard();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container width reactively
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {      
      return;
    }

    const updateWidth = () => {
      const width = container.offsetWidth;
      if (width > 0) {
        setContainerWidth(width);
      }
    };

    // Initial measurement after a small delay to ensure layout is complete
    requestAnimationFrame(updateWidth);

    // Use ResizeObserver for reactive updates
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(container);

    // Also listen to window resize as fallback
    window.addEventListener("resize", updateWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [isLoaded]); // Re-run when isLoaded changes

  // Convert widgets to react-grid-layout format
  const layout: Layout = useMemo(
    () =>
      widgets.map((widget, index) => {
        const dashlet = getDashlet(widget.componentId);
        const layoutDefaults = dashlet?.getLayoutDefaults(widget.config);
        const fallbackMinW = Math.max(1, layoutDefaults?.minW ?? 1);
        const fallbackMinH = Math.max(1, layoutDefaults?.minH ?? 1);
        return {
          i: widget.id,
          x: widget.layout?.x ?? 0,
          y: widget.layout?.y ?? index,
          w: widget.layout?.w ?? fallbackMinW,
          h: widget.layout?.h ?? fallbackMinH,
          isDraggable: editMode,
          isResizable: editMode,
          minW: widget.layout?.minW ?? fallbackMinW,
          maxW: widget.layout?.maxW ?? GRID_COLS,
          minH: widget.layout?.minH ?? fallbackMinH,
          maxH: widget.layout?.maxH ?? Infinity,
        };
      }),
    [widgets, editMode]
  );

  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      if (!editMode) return;
      const items: GridLayoutItem[] = newLayout.map((item: LayoutItem) => {
        // Find existing widget to preserve min/max values
        const existingWidget = widgets.find((w) => w.id === item.i);
        return {
          i: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          minW: existingWidget?.layout?.minW,
          minH: existingWidget?.layout?.minH,
          maxW: existingWidget?.layout?.maxW,
          maxH: existingWidget?.layout?.maxH,
        };
      });
      updateWidgetLayouts(null, items);
    },
    [updateWidgetLayouts, editMode, widgets]
  );

  // Show loading state while data loads from localStorage
  if (!isLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  const hasWidgets = widgets.length > 0;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="-mx-4 -mt-4 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-4 p-4">
          <h1 className="shrink-0 text-xl font-semibold text-gray-900 dark:text-white">
            {dashboardName}
          </h1>
          <div className="flex min-w-0 flex-1 justify-center">
            <DashboardFilterBar />
          </div>
          <div className="flex shrink-0 items-center gap-4">
            {hasWidgets && (
              <ToggleSwitch
                checked={editMode}
                onChange={toggleEditMode}
                label="Edit Mode"
              />
            )}
            <DashboardSettingsDropdown />
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={containerRef} className="w-full min-h-[200px] max-w-screen-2xl mx-auto">
        {hasWidgets ? (
          <>
            {/* Root-level grid - only render when width is measured */}
            {containerWidth > 0 ? (
              <GridLayout
                className="dashboard-root-grid w-full"
                layout={layout}
                width={containerWidth}
                gridConfig={{
                  cols: GRID_COLS,
                  rowHeight: 55,
                  margin: [16, 16] as const,
                  containerPadding: [0, 16] as const,
                  maxRows: Infinity,
                }}
                dragConfig={{
                  enabled: editMode,
                  cancel: ".no-drag, .nested-grid-wrapper .react-grid-item",
                }}
                resizeConfig={{
                  enabled: editMode,
                  handles: ["se"],
                }}
                compactor={verticalCompactor}
                onLayoutChange={handleLayoutChange}
                autoSize={true}
              >
                {widgets.map((widget) => (
                  <div key={widget.id} className="h-full w-full">
                    <WidgetRenderer widget={widget} isRoot={true} />
                  </div>
                ))}
              </GridLayout>
            ) : (
              <div className="text-gray-500">Measuring container width...</div>
            )}

            {/* Add new widget button */}
            {editMode && (
              <div className=" flex justify-center">
                <Button color="light" onClick={() => setIsAddModalOpen(true)}>
                  <HiPlus className="mr-2 h-4 w-4" />
                  Add Widget
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState onAdd={() => setIsAddModalOpen(true)} />
        )}
      </div>

      {/* Add widget modal */}
      <AddWidgetModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        parentId={null}
        parentComponentId={null}
      />

      {/* Custom styles for root grid */}
      <style jsx global>{`
        /* Widget controls - hidden by default */
        .widget-controls {
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
        }

        /* Show controls ONLY when this specific widget is hovered */
        .widget-wrapper:hover > .widget-controls {
          opacity: 1;
          pointer-events: auto;
        }

        /* Hide parent controls when ANY child widget is hovered */
        .widget-wrapper:has(.widget-wrapper:hover) > .widget-controls {
          opacity: 0 !important;
          pointer-events: none !important;
        }

        .dashboard-root-grid {
          user-select: none;
          -webkit-user-select: none;
        }

        .dashboard-root-grid .react-grid-item {
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        /* Placeholder shown when dragging/resizing */
        .dashboard-root-grid .react-grid-item.react-grid-placeholder {
          background: rgba(59, 130, 246, 0.08) !important;
          border: 2px dashed rgba(59, 130, 246, 0.4) !important;
          border-radius: 0.5rem;
          opacity: 1 !important;
        }

        .dashboard-root-grid .react-grid-item.react-draggable-dragging {
          z-index: 100;
          box-shadow:
            0 20px 25px -5px rgba(0, 0, 0, 0.1),
            0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        /* Hide all resize handles by default and reset transforms */
        .dashboard-root-grid .react-grid-item > .react-resizable-handle {
          background: none !important;
          opacity: 0;
          transition: opacity 0.15s ease;
          transform: none !important;
        }

        .dashboard-root-grid .react-grid-item > .react-resizable-handle::after {
          transform: none !important;
        }

        /* Show handles on hover */
        .dashboard-root-grid .react-grid-item:hover > .react-resizable-handle {
          opacity: 1;
        }

        /* East (right) handle - thin border line */
        .dashboard-root-grid .react-grid-item > .react-resizable-handle-e {
          width: 6px !important;
          height: 100% !important;
          right: 0 !important;
          top: 0 !important;
          bottom: auto !important;
          left: auto !important;
          cursor: ew-resize;
        }
        .dashboard-root-grid
          .react-grid-item
          > .react-resizable-handle-e::after {
          content: "";
          position: absolute;
          right: 2px;
          top: 50%;
          transform: translateY(-50%) !important;
          width: 2px;
          height: 32px;
          background: rgba(156, 163, 175, 0.35);
          border-radius: 1px;
          border: none !important;
        }

        /* West (left) handle - thin border line */
        .dashboard-root-grid .react-grid-item > .react-resizable-handle-w {
          width: 6px !important;
          height: 100% !important;
          left: 0 !important;
          top: 0 !important;
          bottom: auto !important;
          right: auto !important;
          cursor: ew-resize;
        }
        .dashboard-root-grid
          .react-grid-item
          > .react-resizable-handle-w::after {
          content: "";
          position: absolute;
          left: 2px;
          top: 50%;
          transform: translateY(-50%) !important;
          width: 2px;
          height: 32px;
          background: rgba(156, 163, 175, 0.35);
          border-radius: 1px;
          border: none !important;
        }

        /* South (bottom) handle - thin border line */
        .dashboard-root-grid .react-grid-item > .react-resizable-handle-s {
          height: 6px !important;
          width: 100% !important;
          bottom: 0 !important;
          left: 0 !important;
          top: auto !important;
          right: auto !important;
          cursor: ns-resize;
        }
        .dashboard-root-grid
          .react-grid-item
          > .react-resizable-handle-s::after {
          content: "";
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%) !important;
          height: 2px;
          width: 32px;
          background: rgba(156, 163, 175, 0.35);
          border-radius: 1px;
          border: none !important;
        }

        /* Southeast corner handle - diagonal lines */
        .dashboard-root-grid .react-grid-item > .react-resizable-handle-se {
          width: 16px !important;
          height: 16px !important;
          right: 0 !important;
          bottom: 0 !important;
          top: auto !important;
          left: auto !important;
          cursor: nwse-resize;
        }
        .dashboard-root-grid
          .react-grid-item
          > .react-resizable-handle-se::after {
          content: "";
          position: absolute;
          right: 4px;
          bottom: 4px;
          width: 8px;
          height: 8px;
          border-right: 2px solid rgba(156, 163, 175, 0.35);
          border-bottom: 2px solid rgba(156, 163, 175, 0.35);
          border-radius: 0 0 2px 0;
          background: none !important;
          transform: none !important;
        }

        /* Southwest corner handle - small dot */
        .dashboard-root-grid .react-grid-item > .react-resizable-handle-sw {
          width: 12px !important;
          height: 12px !important;
          left: 0 !important;
          bottom: 0 !important;
          top: auto !important;
          right: auto !important;
          cursor: nesw-resize;
        }
        .dashboard-root-grid
          .react-grid-item
          > .react-resizable-handle-sw::after {
          content: "";
          position: absolute;
          left: 3px;
          bottom: 3px;
          width: 6px;
          height: 6px;
          background: rgba(156, 163, 175, 0.6);
          border-radius: 50%;
          border: none !important;
          transform: none !important;
        }

        /* Hover state - make handles more visible */
        .dashboard-root-grid
          .react-grid-item:hover
          > .react-resizable-handle::after {
          background: rgba(107, 114, 128, 0.8);
        }
      `}</style>
    </div>
  );
}
