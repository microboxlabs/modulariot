"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { Button, ToggleSwitch } from "flowbite-react";
import {
  HiPlus,
  HiArrowUturnLeft,
  HiArrowUturnRight,
  HiArrowsPointingOut,
} from "react-icons/hi2";
import {
  GridLayout,
  verticalCompactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import { createScaledStrategy } from "react-grid-layout/core";
import Link from "next/link";
import { useSearchParams, usePathname, useParams } from "next/navigation";
import { KIOSK_PARAM } from "@/features/layout/hooks/use-kiosk-mode";
import { useDashboard } from "../../context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";
import { useDashboardAccess } from "@/features/common/providers/client-api.provider";
import { EmptyState } from "../empty-state";

// ── Placeholder (skeleton or empty state) ──────────────────────────────

interface DashboardPlaceholderProps {
  isLoaded: boolean;
  onAdd?: () => void;
}

function DashboardPlaceholder({
  isLoaded,
  onAdd,
}: Readonly<DashboardPlaceholderProps>) {
  if (isLoaded) {
    return <EmptyState onAdd={onAdd} />;
  }
  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: "repeat(24, minmax(0, 1fr))",
        gridAutoRows: "minmax(150px, 1fr)",
      }}
    >
      <div className="col-span-12 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="col-span-12 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="col-span-8 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="col-span-8 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="col-span-8 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="col-span-16 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
      <div className="col-span-8 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}
import { WidgetRenderer } from "../widget-renderer";
import { AddWidgetModal } from "../add-widget-modal/add-widget-modal";
import { getDashlet } from "../../dashlets";
import { type GridLayoutItem } from "../../types/dashboard.types";
import { computeGridSizing } from "../../utils/grid-sizing";
import { fitLayoutToCols } from "../../utils/fit-layout-to-cols";

import { DashboardSettingsDropdown } from "../dashboard-settings-dropdown";
import DashboardShareDropdown from "../dashboard-share-dropdown/dashboard-share-dropdown";
import { DashboardNavbarPortal } from "../dashboard-navbar-portal";
import { DashboardFiltersCard } from "../dashboard-filters-card/dashboard-filters-card";

/**
 * Main dashboard view component
 * Renders all root-level widgets with edit mode controls using react-grid-layout
 */
export function DashboardView() {
  const {
    widgets,
    editMode,
    isKiosk,
    isLoaded,
    dashboardName,
    setDashboardName,
    dictionary,
    siteId,
    toggleEditMode,
    setEditMode,
    updateWidgetLayouts,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useDashboard();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const params = useParams<{ slug: string }>();

  const { canEdit, canManagePermissions } = useDashboardAccess(
    siteId,
    params.slug
  );

  // Force edit mode off for read-only users so they can never accidentally
  // stay in edit mode if their role was downgraded mid-session.
  useEffect(() => {
    if (!canEdit && editMode) {
      setEditMode(false);
    }
  }, [canEdit, editMode, setEditMode]);

  const kioskUrl = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(KIOSK_PARAM, "true");
    return `${pathname}?${params.toString()}`;
  }, [searchParams, pathname]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const hasWidgets = isLoaded && widgets.length > 0;

  // Columns the current arrangement occupies (max x + w across widgets).
  // Resolve missing widths via the dashlet layout defaults so this matches the
  // width the grid actually renders (see the `layout` memo). Otherwise `cols`
  // could be smaller than a widget's real extent and react-grid-layout would
  // clamp it and persist the shifted position.
  const usedCols = useMemo(
    () =>
      widgets.reduce((max, w) => {
        const defaults = getDashlet(w.componentId)?.getLayoutDefaults(w.config);
        const width = w.layout?.w ?? Math.max(1, defaults?.minW ?? 1);
        return Math.max(max, (w.layout?.x ?? 0) + width);
      }, 0),
    [widgets]
  );

  // Grow-columns sizing: wide screens expose extra columns in edit mode; view
  // mode fills the width (scaled, clamped). See utils/grid-sizing.ts.
  const { cols, designWidth, scale, offsetLeft } = useMemo(
    () => computeGridSizing({ containerWidth, usedCols, editMode }),
    [containerWidth, usedCols, editMode]
  );

  // Keeps drag/resize math correct under the CSS transform.
  const positionStrategy = useMemo(() => createScaledStrategy(scale), [scale]);

  // Inline name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(dashboardName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditedName(dashboardName);
  }, [dashboardName]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameClick = useCallback(() => {
    if (editMode) {
      setIsEditingName(true);
    }
  }, [editMode]);

  const handleNameSave = useCallback(() => {
    const trimmed = editedName.trim();
    if (!trimmed) {
      setEditedName(dashboardName);
    } else if (trimmed !== dashboardName) {
      setDashboardName(trimmed);
    }
    setIsEditingName(false);
  }, [editedName, dashboardName, setDashboardName]);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleNameSave();
      } else if (e.key === "Escape") {
        setEditedName(dashboardName);
        setIsEditingName(false);
      }
    },
    [handleNameSave, dashboardName]
  );

  const renderDashboardName = () => {
    if (isEditingName) {
      return (
        <input
          ref={nameInputRef}
          type="text"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onBlur={handleNameSave}
          onKeyDown={handleNameKeyDown}
          className="shrink-0 text-xl font-semibold text-gray-900 dark:text-white bg-transparent border-0 border-b-2 border-blue-500 outline-none px-0 py-0 min-w-[120px]"
        />
      );
    }

    if (editMode) {
      return (
        <button
          type="button"
          className="shrink-0 text-xl font-semibold text-gray-900 dark:text-white cursor-text border-b border-transparent hover:border-dashed hover:border-gray-400 dark:hover:border-gray-500 transition-colors bg-transparent p-0"
          onClick={handleNameClick}
        >
          {dashboardName}
        </button>
      );
    }

    return (
      <h1 className="shrink-0 text-xl font-semibold text-gray-900 dark:text-white">
        {dashboardName}
      </h1>
    );
  };

  // Measure the available container width; it drives the column count and scale.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const measure = (width: number) => {
      if (width > 0) {
        setContainerWidth(width);
      }
    };

    // Initial measurement after layout is complete.
    requestAnimationFrame(() => {
      const style = getComputedStyle(container);
      const px =
        Number.parseFloat(style.paddingLeft) +
        Number.parseFloat(style.paddingRight);
      measure(container.clientWidth - px);
    });

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        measure(entry.contentRect.width);
      }
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Reserve the *scaled* grid height in normal flow. CSS transforms don't change
  // the layout box, so without this the scaled grid would overlap the "Add widget"
  // button at scale > 1 or leave a gap at < 1. Re-runs when scale/cols change and
  // observes the grid so the slot tracks widgets being added/removed/resized.
  useEffect(() => {
    const grid = gridRef.current;
    const clip = clipRef.current;
    if (!grid || !clip) {
      return;
    }
    const apply = () => {
      clip.style.height = `${grid.offsetHeight * scale}px`;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [scale, cols, designWidth, hasWidgets]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editMode) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (target?.isContentEditable) return;

      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    };
    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [editMode, undo, redo]);

  // Convert widgets to react-grid-layout format
  const layout: Layout = useMemo(() => {
    const items = widgets.map((widget, index) => {
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
        // Allow resizing up to the currently-available columns so widgets can
        // be dragged into the surplus columns that appear on wide screens.
        // Positions are stored in absolute column units that may exceed the
        // base 24. Accepted trade-off: editing the same dashboard on a
        // narrower screen can make react-grid-layout reflow such widgets back
        // inside the visible columns and persist that (view mode never
        // persists reflows — see the editMode guard in handleLayoutChange).
        maxW: widget.layout?.maxW ?? cols,
        minH: widget.layout?.minH ?? fallbackMinH,
        maxH: widget.layout?.maxH ?? Infinity,
      };
    });
    // In view mode, fit over-wide widgets into the columns that fit the screen
    // (clamp + re-pack) so a widened board doesn't shrink the whole view on a
    // smaller screen. Display-only — never persisted (handleLayoutChange returns
    // early when not in edit mode).
    return editMode ? items : fitLayoutToCols(items, cols);
  }, [widgets, editMode, cols]);

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

  return (
    <div className="flex h-full w-full flex-col">
      {/* Portal: renders DashboardFilterBar into the navbar search slot */}
      {!isKiosk && <DashboardNavbarPortal />}

      {/* Header (hidden in kiosk mode) */}
      {!isKiosk && (
        <div className="shrink-0 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between gap-4 p-4">
            {isLoaded ? (
              renderDashboardName()
            ) : (
              <div className="h-7 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            )}
            <div className="flex shrink-0 items-center gap-4">
              {editMode && (
                <div className="flex items-center gap-1">
                  <Button
                    size="xs"
                    color="light"
                    onClick={undo}
                    disabled={!canUndo()}
                    title={`${tr("dashboard.undo", dictionary)} (Ctrl+Z)`}
                  >
                    <HiArrowUturnLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="xs"
                    color="light"
                    onClick={redo}
                    disabled={!canRedo()}
                    title={`${tr("dashboard.redo", dictionary)} (Ctrl+Shift+Z)`}
                  >
                    <HiArrowUturnRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {hasWidgets && canEdit && (
                <ToggleSwitch
                  checked={editMode}
                  onChange={toggleEditMode}
                  label={tr("dashboard.editMode", dictionary)}
                />
              )}
              {canEdit && (
                <DashboardSettingsDropdown
                  canManagePermissions={canManagePermissions}
                />
              )}
              <DashboardShareDropdown />
              <Link
                href={kioskUrl}
                target="_blank"
                title={tr("dashboard.kioskMode", dictionary)}
                className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-2.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
              >
                <HiArrowsPointingOut className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Filters card */}
      {!isKiosk && (
        <div className="shrink-0 px-4 pt-4">
          <DashboardFiltersCard />
        </div>
      )}

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
        <div ref={containerRef} className="w-full min-h-full">
          {hasWidgets ? (
            <div ref={clipRef} style={{ width: "100%", overflow: "visible" }}>
              <div
                style={{
                  width: designWidth,
                  marginLeft: offsetLeft,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  transition:
                    containerWidth > 0
                      ? "transform 150ms ease, margin-left 150ms ease"
                      : undefined,
                  position: "relative",
                }}
                ref={gridRef}
              >
                {/* Grid cell overlay — only visible in edit mode */}
                {editMode &&
                  (() => {
                    const colW = (designWidth - 16 * (cols - 1)) / cols;
                    const colP = colW + 16;
                    const rowH = 55;
                    const rowP = 71;
                    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${colP}' height='${rowP}'><rect x='0' y='0' width='${colW}' height='${rowH}' rx='6' fill='rgba(55,65,81,0.25)'/></svg>`;
                    return (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
                          backgroundSize: `${colP}px ${rowP}px`,
                          backgroundRepeat: "repeat",
                          zIndex: 0,
                        }}
                      />
                    );
                  })()}
                <GridLayout
                  className="dashboard-root-grid w-full"
                  layout={layout}
                  width={designWidth}
                  positionStrategy={positionStrategy}
                  gridConfig={{
                    cols,
                    rowHeight: 55,
                    margin: [16, 16] as const,
                    containerPadding: [0, 0] as const,
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
              </div>
            </div>
          ) : (
            <DashboardPlaceholder
              isLoaded={isLoaded}
              onAdd={canEdit ? () => setIsAddModalOpen(true) : undefined}
            />
          )}

          {/* Add new widget button — outside the scaled grid */}
          {hasWidgets && editMode && (
            <div className="flex justify-center pt-4">
              <Button color="light" onClick={() => setIsAddModalOpen(true)}>
                <HiPlus className="mr-2 h-4 w-4" />
                {tr("dashboard.addWidget", dictionary)}
              </Button>
            </div>
          )}
        </div>
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
          z-index: 60;
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
