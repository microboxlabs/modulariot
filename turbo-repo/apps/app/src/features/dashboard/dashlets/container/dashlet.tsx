"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { HiArrowRight } from "react-icons/hi2";
import {
  GridLayout,
  verticalCompactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import {
  type PgrestParam,
  type PgrestHttpMethod,
} from "../common/pgrest-types";
import { usePgrestResolvedFields } from "../common/use-pgrest-resolved-fields";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import type { GridLayoutItem } from "../../types/dashboard.types";
import { useDashboard } from "../../context/dashboard-context";

import "react-grid-layout/css/styles.css";

// ============================================================================
// Types
// ============================================================================

/** Container variant type */
export type ContainerVariant = "bento-box" | "labeled-group";

/** Configuration for container dashlet */
export interface DashletConfig {
  /** Container variant: bento-box or labeled-group */
  variant: ContainerVariant;

  // Bento Box specific fields
  /** Name/title for bento-box variant */
  name?: string;
  /** Description for bento-box variant */
  description?: string;
  /** URL for "Ver más" button in bento-box variant */
  verMasUrl?: string;
  /** Whether to open the "Ver más" link in the same tab instead of a new one */
  openInSameTab?: boolean;

  // Labeled Group specific fields
  /** Label text for labeled-group variant */
  label?: string;
  /** Border color for labeled-group variant (hex without #) */
  borderColor?: string;

  // Data source fields (for resolving display fields via Handlebars templates)
  dataMode?: "static" | "pgrest" | "planner";
  pgrestFunctionName?: string;
  pgrestParams?: PgrestParam[];
  pgrestHttpMethod?: PgrestHttpMethod;
  plannerVariableName?: string;
  dataSourceId?: string;
  refreshInterval?: number;
}

/** Default configuration for a new container */
export const defaultConfig: DashletConfig = {
  variant: "bento-box",
  name: "Untitled",
  description: "",
  verMasUrl: "",
  label: "Group",
  borderColor: "6b7280",
  dataMode: "static",
};

const CONTAINER_VARIANT_LAYOUT_DEFAULTS: Record<
  ContainerVariant,
  DashletLayoutDefaults
> = {
  "bento-box": { minW: 4, minH: 4 },
  "labeled-group": { minW: 4, minH: 2 },
};

export function getLayoutDefaults(
  config?: Record<string, unknown>
): DashletLayoutDefaults {
  const variant = (config as DashletConfig | undefined)?.variant ?? "bento-box";
  return (
    CONTAINER_VARIANT_LAYOUT_DEFAULTS[variant] ??
    CONTAINER_VARIANT_LAYOUT_DEFAULTS["bento-box"]
  );
}

// ============================================================================
// Color Normalization
// ============================================================================

const DEFAULT_BORDER_COLOR = "#6b7280";

/** Known color token names mapped to their hex values */
const COLOR_TOKEN_MAP: Record<string, string> = {
  gray: "#6b7280",
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#eab308",
  purple: "#a855f7",
  orange: "#f97316",
};

/** Validates if a string is a valid 3 or 6 character hex color (without #) */
function isValidHex(value: string): boolean {
  return /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value);
}

/**
 * Normalizes a border color value to a valid CSS hex color.
 * Handles legacy formats: color tokens, hex with/without #, whitespace.
 */
function normalizeBorderColor(value: string | undefined): string {
  if (!value) return DEFAULT_BORDER_COLOR;

  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_BORDER_COLOR;

  // Already a valid CSS color with #
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    return isValidHex(hex) ? trimmed : DEFAULT_BORDER_COLOR;
  }

  // Check if it's a known color token
  const tokenColor = COLOR_TOKEN_MAP[trimmed.toLowerCase()];
  if (tokenColor) return tokenColor;

  // Assume it's a hex value without # prefix
  if (isValidHex(trimmed)) return `#${trimmed}`;

  // Invalid value, use default
  return DEFAULT_BORDER_COLOR;
}

// ============================================================================
// Helper Components
// ============================================================================

interface GridContentProps {
  hasChildren: boolean;
  isReady: boolean;
  editMode: boolean;
  emptyMessage: string;
  children: React.ReactNode;
}

/** Renders the grid content based on state - avoids nested ternaries */
function GridContent({
  hasChildren,
  isReady,
  editMode,
  emptyMessage,
  children,
}: Readonly<GridContentProps>) {
  if (!hasChildren) {
    if (editMode) return null;
    return (
      <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex h-20 items-center justify-center text-gray-400">
        <p className="text-sm">Measuring...</p>
      </div>
    );
  }

  return <>{children}</>;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Unified Container Dashlet
 *
 * Can be configured as:
 * - Bento Box: Full header with name, description, and "Ver más" link
 * - Labeled Group: Fieldset-legend style with colored border
 */
export function Dashlet({
  widget,
  editMode,
  isRoot,
  onAddChild,
  children,
}: Readonly<DashletComponentProps>) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { updateWidgetLayouts } = useDashboard();

  const config = (widget.config as unknown as DashletConfig) ?? defaultConfig;
  const variant = config.variant ?? "bento-box";
  const widgetChildren = widget.children ?? [];
  const hasChildren = widgetChildren.length > 0;

  // Resolve display fields via Handlebars templates when data mode is pgrest/planner
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);
  const { resolved } = usePgrestResolvedFields({
    dataMode: config.dataMode || "static",
    pgrestFunctionName: config.pgrestFunctionName || "",
    pgrestHttpMethod: config.pgrestHttpMethod || "POST",
    pgrestParams: config.pgrestParams || [],
    plannerVariableName: config.plannerVariableName,
    fields: {
      name: config.name || "Untitled",
      description: config.description || "",
      label: config.label || "Group",
    },
    dataSourceId: config.dataSourceId,
    refreshIntervalMs,
  });
  const nestedGridRef = useRef<HTMLDivElement>(null);

  // Stop propagation on nested grid to prevent parent grid from capturing drag events
  useEffect(() => {
    const el = nestedGridRef.current;
    if (!el) return;

    const stopPropagation = (e: Event) => e.stopPropagation();
    el.addEventListener("mousedown", stopPropagation);
    el.addEventListener("touchstart", stopPropagation);

    return () => {
      el.removeEventListener("mousedown", stopPropagation);
      el.removeEventListener("touchstart", stopPropagation);
    };
  }, []);

  // Calculate responsive columns based on container width
  // Use ceil so column width is always <= 100px (items never grow larger than intended)
  const cols = useMemo(() => {
    if (containerWidth <= 0) return 12;
    // Target max 100px per column, minimum 2 cols, maximum 12 cols
    const calculatedCols = Math.ceil(containerWidth / 100);
    return Math.max(2, Math.min(12, calculatedCols));
  }, [containerWidth]);

  // Measure container dimensions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    setContainerWidth(container.offsetWidth);
    setContainerHeight(container.offsetHeight);

    return () => resizeObserver.disconnect();
  }, []);

  // Convert children to react-grid-layout format
  // Clamp x positions and widths to fit within current column count
  const layout: Layout = useMemo(
    () =>
      widgetChildren.map((child, index) => {
        const fallbackMinW = Math.max(
          1,
          child.layout?.minW ?? child.layout?.w ?? 1
        );
        const fallbackMinH = Math.max(
          1,
          child.layout?.minH ?? child.layout?.h ?? 1
        );
        const savedW = child.layout?.w ?? fallbackMinW;
        const savedX = child.layout?.x ?? index % cols;
        // Clamp width to fit within cols, and adjust x if needed
        const w = Math.min(savedW, cols);
        const x = Math.min(savedX, cols - w);
        return {
          i: child.id,
          x,
          y: child.layout?.y ?? Math.floor(index / cols),
          w,
          h: child.layout?.h ?? fallbackMinH,
          isDraggable: editMode,
          isResizable: editMode,
          minW: Math.min(child.layout?.minW ?? fallbackMinW, cols),
          maxW: Math.min(child.layout?.maxW ?? 12, cols),
          minH: child.layout?.minH ?? fallbackMinH,
          maxH: child.layout?.maxH ?? Infinity,
        };
      }),
    [widgetChildren, editMode, cols]
  );

  // Handler for user-initiated drag/resize stop - only save on user interaction
  const handleDragResizeStop = useCallback(
    (layout: Layout) => {
      if (!editMode) return;
      const items: GridLayoutItem[] = layout.map((item: LayoutItem) => {
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

  const handleVerMasClick = () => {
    if (config.verMasUrl) {
      if (config.openInSameTab) {
        globalThis.location.href = config.verMasUrl;
      } else {
        globalThis.open(config.verMasUrl, "_blank", "noopener,noreferrer");
      }
    }
  };

  // Get normalized border color for labeled-group
  const borderColor = normalizeBorderColor(config.borderColor);

  // Background color for label depends on context
  const labelBgClass = isRoot
    ? "bg-gray-50 dark:bg-gray-900"
    : "bg-white dark:bg-gray-800";

  // Dynamic row height calculation to fit items without scrolling
  const marginY = 9;

  const maxRows = useMemo(() => {
    if (widgetChildren.length === 0) return 1;
    return Math.max(
      ...widgetChildren.map((child) => {
        const y = child.layout?.y ?? 0;
        const height = Math.max(1, child.layout?.h ?? child.layout?.minH ?? 1);
        return y + height;
      })
    );
  }, [widgetChildren]);

  const dynamicRowHeight = useMemo(() => {
    if (containerHeight <= 0 || maxRows <= 0) return 80;
    const availableHeight = containerHeight;
    const totalMargins = (maxRows - 1) * marginY;
    const calculatedRowHeight = (availableHeight - totalMargins) / maxRows;
    return Math.max(40, Math.min(55, calculatedRowHeight));
  }, [containerHeight, maxRows, marginY]);

  // ============================================================================
  // Bento Box Variant
  // ============================================================================
  if (variant === "bento-box") {
    return (
      <div
        className={`flex flex-col rounded-lg ring-1 ring-gray-200 bg-white shadow-sm dark:ring-gray-700 dark:bg-gray-800 h-full`}
      >
        {/* Header with name, description, and Ver más button - fixed 80px height (1 row) */}
        <div className="flex h-[65px] shrink-0 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-700">
          <div className="min-w-0 flex-1">
            {/* Name */}
            <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
              {resolved.name || "Untitled"}
            </h3>

            {/* Description */}
            {resolved.description && (
              <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                {resolved.description}
              </p>
            )}
          </div>

          {/* Ver más button */}
          {config.verMasUrl && (
            <button
              type="button"
              onClick={handleVerMasClick}
              onMouseDown={(e) => e.stopPropagation()}
              className="no-drag ml-4 flex shrink-0 items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer"
            >
              Ver más
              <HiArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Grid Content */}
        <div
          ref={containerRef}
          className={`p-2 min-h-0 flex-1 overflow-hidden`}
        >
          <GridContent
            hasChildren={hasChildren}
            isReady={containerWidth > 0}
            editMode={editMode}
            emptyMessage="No widgets yet"
          >
            <div ref={nestedGridRef} className="nested-grid-wrapper">
              <GridLayout
                className="container-grid"
                layout={layout}
                width={containerWidth}
                gridConfig={{
                  cols,
                  rowHeight: dynamicRowHeight,
                  margin: [16, marginY] as const,
                  containerPadding: [0, 0] as const,
                  maxRows: Infinity,
                }}
                dragConfig={{
                  enabled: editMode,
                  cancel: ".no-drag",
                }}
                resizeConfig={{
                  enabled: editMode,
                  handles: ["se"],
                }}
                compactor={verticalCompactor}
                onDragStop={(layout) => handleDragResizeStop(layout)}
                onResizeStop={(layout) => handleDragResizeStop(layout)}
                autoSize={true}
              >
                {children}
              </GridLayout>
            </div>
          </GridContent>
        </div>

        <ContainerGridStyles />
      </div>
    );
  }
  // ============================================================================
  // Labeled Group Variant
  // ============================================================================
  return (
    <div
      className="relative flex flex-col rounded-lg border pt-1 h-full"
      style={{ borderColor }}
    >
      {/* Label that cuts into border (fieldset-legend style) */}
      <span
        className={`absolute -top-3 left-3 z-10 px-2 text-sm font-medium text-gray-500 dark:text-gray-400 ${labelBgClass}`}
      >
        {resolved.label || "Group"}
      </span>

      {/* Children content with grid layout */}
      <div
        ref={containerRef}
        className={`p-2.5 min-h-0 flex-1 overflow-hidden`}
      >
        <GridContent
          hasChildren={hasChildren}
          isReady={containerWidth > 0 && containerHeight > 0}
          editMode={editMode}
          emptyMessage="Empty group"
        >
          <div ref={nestedGridRef} className="nested-grid-wrapper">
            <GridLayout
              className="container-grid"
              layout={layout}
              width={containerWidth}
              gridConfig={{
                cols,
                rowHeight: dynamicRowHeight,
                margin: [16, marginY] as const,
                containerPadding: [0, 0] as const,
                maxRows: Infinity,
              }}
              dragConfig={{
                enabled: editMode,
                cancel: ".no-drag",
              }}
              resizeConfig={{
                enabled: editMode,
                handles: ["se"],
              }}
              compactor={verticalCompactor}
              onDragStop={(layout) => handleDragResizeStop(layout)}
              onResizeStop={(layout) => handleDragResizeStop(layout)}
              autoSize={true}
            >
              {children}
            </GridLayout>
          </div>
        </GridContent>
      </div>

      <ContainerGridStyles />
    </div>
  );
}

// ============================================================================
// Shared Grid Styles
// ============================================================================

function ContainerGridStyles() {
  return (
    <style jsx global>{`
      .container-grid {
        user-select: none;
        -webkit-user-select: none;
      }
      .container-grid .react-grid-item {
        user-select: none;
        -webkit-user-select: none;
      }
      .container-grid .react-grid-item.react-grid-placeholder {
        background: rgba(59, 130, 246, 0.08) !important;
        border-radius: 0.5rem;
        border: 2px dashed rgba(59, 130, 246, 0.4) !important;
        opacity: 1 !important;
      }
      .container-grid .react-grid-item.react-draggable-dragging {
        z-index: 100;
        opacity: 0.9;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        user-select: none;
        -webkit-user-select: none;
      }

      /* Hide all resize handles by default */
      .container-grid .react-grid-item > .react-resizable-handle {
        background: none !important;
        opacity: 0;
        transition: opacity 0.15s ease;
        transform: none !important;
      }
      .container-grid .react-grid-item > .react-resizable-handle::after {
        transform: none !important;
      }

      /* Show handles on hover */
      .container-grid .react-grid-item:hover > .react-resizable-handle {
        opacity: 1;
      }

      /* East (right) handle */
      .container-grid .react-grid-item > .react-resizable-handle-e {
        width: 6px !important;
        height: 100% !important;
        right: 0 !important;
        top: 0 !important;
        cursor: ew-resize;
      }
      .container-grid .react-grid-item > .react-resizable-handle-e::after {
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
      .container-grid .react-grid-item > .react-resizable-handle-s {
        height: 6px !important;
        width: 100% !important;
        bottom: 0 !important;
        left: 0 !important;
        cursor: ns-resize;
      }
      .container-grid .react-grid-item > .react-resizable-handle-s::after {
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
      .container-grid .react-grid-item > .react-resizable-handle-se {
        width: 14px !important;
        height: 14px !important;
        right: 0 !important;
        bottom: 0 !important;
        cursor: nwse-resize;
      }
      .container-grid .react-grid-item > .react-resizable-handle-se::after {
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
  );
}
