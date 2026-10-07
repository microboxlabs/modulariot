"use client";
import { DASHBOARD_DRAG_CANCEL_SELECTOR } from "../core/grid-interactions";

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import {
  GridLayout,
  verticalCompactor,
  type Layout,
  type LayoutItem,
} from "react-grid-layout";
import { createScaledStrategy } from "react-grid-layout/core";
import type {
  Widget,
  GridLayoutItem,
} from "@microboxlabs/miot-dashboard-contract/document";
import { computeGridSizing } from "../core/grid-sizing";

export interface DashboardGridProps {
  widgets: readonly Widget[];
  registry: {
    get(id: string):
      | {
          getLayoutDefaults(config: Widget["config"]): {
            minW?: number;
            minH?: number;
          };
        }
      | undefined;
  };
  renderWidget(widget: Widget): ReactNode;
  /** Enable only when the host has current server edit permission. */
  editMode?: boolean;
  /** Called only after a user completes a drag or resize, never on viewport changes. */
  onLayoutCommit?: (layout: GridLayoutItem[]) => void;
}

function fitLayoutToCols(layout: Layout, cols: number): Layout {
  const clamped = layout.map((item) => {
    const w = Math.min(item.w, cols);
    const x = Math.max(0, Math.min(item.x, cols - w));
    return {
      ...item,
      x,
      w,
      minW: Math.min(item.minW ?? 1, cols),
      maxW: Math.min(item.maxW ?? cols, cols),
    };
  });
  return verticalCompactor.compact(clamped, cols);
}

/** Preserve stored coordinates when a gesture did not change their fitted value. */
function mergeGesture(
  item: LayoutItem,
  previous: LayoutItem | undefined,
  widget: Widget | undefined,
): GridLayoutItem {
  const coordinate = (key: "x" | "y" | "w" | "h") =>
    previous?.[key] === item[key]
      ? (widget?.layout?.[key] ?? item[key])
      : item[key];
  return {
    i: item.i,
    x: coordinate("x"),
    y: coordinate("y"),
    w: coordinate("w"),
    h: coordinate("h"),
    minW: widget?.layout?.minW,
    minH: widget?.layout?.minH,
    maxW: widget?.layout?.maxW,
    maxH: widget?.layout?.maxH,
  };
}

export function DashboardGrid({
  widgets,
  registry,
  renderWidget,
  editMode: requestedEditMode = false,
  onLayoutCommit,
}: Readonly<DashboardGridProps>) {
  const editMode = requestedEditMode && !!onLayoutCommit;
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const hasWidgets = widgets.length > 0;
  // Columns the current arrangement occupies (max x + w across widgets).
  // Resolve missing widths via the dashlet layout defaults so this matches the
  // width the grid actually renders (see the `layout` memo). Otherwise `cols`
  // could be smaller than a widget's real extent and react-grid-layout would
  // clamp it and persist the shifted position.
  const usedCols = useMemo(
    () =>
      widgets.reduce((max, w) => {
        const defaults = registry
          .get(w.componentId)
          ?.getLayoutDefaults(w.config);
        const width = w.layout?.w ?? Math.max(1, defaults?.minW ?? 1);
        return Math.max(max, (w.layout?.x ?? 0) + width);
      }, 0),
    [widgets, registry],
  );

  // Grid sizing: fills the width (scaled, clamped), identically in edit and
  // view mode so the board looks the same regardless of mode. See
  // utils/grid-sizing.ts.
  const { cols, designWidth, scale, offsetLeft } = useMemo(
    () => computeGridSizing({ containerWidth, usedCols }),
    [containerWidth, usedCols],
  );

  // Keeps drag/resize math correct under the CSS transform.
  const positionStrategy = useMemo(() => createScaledStrategy(scale), [scale]);

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
    const frame = requestAnimationFrame(() => {
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

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
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

  // Convert widgets to react-grid-layout format
  const layout: Layout = useMemo(() => {
    const items = widgets.map((widget, index) => {
      const dashlet = registry.get(widget.componentId);
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
        // Positions are stored in absolute column units that may exceed the
        // currently-visible `cols`; fitLayoutToCols (below) clamps them into
        // view for both modes so edit and view render identically.
        maxW: widget.layout?.maxW ?? cols,
        minH: widget.layout?.minH ?? fallbackMinH,
        maxH: widget.layout?.maxH ?? Infinity,
      };
    });
    // Fit over-wide widgets into the columns that fit the screen (clamp +
    // re-pack) in both modes, so a widened board doesn't shrink the whole
    // view on a smaller screen and edit mode matches view mode. Display-only
    // — never persisted directly; handleLayoutChange only persists positions
    // the user actually drags/resizes to while in edit mode.
    return fitLayoutToCols(items, cols);
  }, [widgets, editMode, cols, registry]);

  const gestureLayout = useRef<Layout | null>(null);
  const beginGesture = () => {
    gestureLayout.current = layout.map((item) => ({ ...item }));
  };

  // Persist only on drag/resize *stop*, not onLayoutChange: react-grid-layout
  // also fires onLayoutChange from prop-driven re-syncs (e.g. a cols change on
  // window resize, or mount) with no user interaction involved. Since the
  // `layout` prop is now the fitted/clamped view in both modes, using
  // onLayoutChange here would silently persist that clamped layout over the
  // stored positions any time the viewport changes. onDragStop/onResizeStop
  // only fire from an actual completed pointer drag/resize (see the
  // container dashlet's nested grid for the same pattern).
  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      if (!editMode) return;
      const before = gestureLayout.current ?? layout;
      gestureLayout.current = null;
      const items: GridLayoutItem[] = newLayout.map((item: LayoutItem) => {
        // Find existing widget to preserve min/max values
        const existingWidget = widgets.find((w) => w.id === item.i);
        const previous = before.find((entry) => entry.i === item.i);
        return mergeGesture(item, previous, existingWidget);
      });
      onLayoutCommit?.(items);
    },
    [onLayoutCommit, editMode, widgets, layout],
  );

  return (
    <div
      ref={containerRef}
      className={
        editMode
          ? "miot-dashboard-grid miot-dashboard-grid--editing"
          : "miot-dashboard-grid"
      }
    >
      <div ref={clipRef} className="miot-dashboard-grid__clip">
        <div
          ref={gridRef}
          className="miot-dashboard-grid__scaled"
          style={{
            width: designWidth,
            marginLeft: offsetLeft,
            transform: `scale(${scale})`,
          }}
        >
          {editMode && <GridOverlay cols={cols} width={designWidth} />}
          <GridLayout
            className="miot-dashboard-grid__layout dashboard-root-grid"
            layout={layout}
            width={designWidth}
            positionStrategy={positionStrategy}
            gridConfig={{
              cols,
              rowHeight: 55,
              margin: [16, 16],
              containerPadding: [0, 0],
              maxRows: Infinity,
            }}
            dragConfig={{
              enabled: editMode,
              cancel: DASHBOARD_DRAG_CANCEL_SELECTOR,
            }}
            resizeConfig={{ enabled: editMode, handles: ["se"] }}
            compactor={verticalCompactor}
            onDragStart={beginGesture}
            onResizeStart={beginGesture}
            onDragStop={handleLayoutChange}
            onResizeStop={handleLayoutChange}
            autoSize
          >
            {widgets.map((widget) => (
              <div key={widget.id} className="miot-dashboard-grid__cell">
                {renderWidget(widget)}
              </div>
            ))}
          </GridLayout>
        </div>
      </div>
    </div>
  );
}

function GridOverlay({
  cols,
  width,
}: Readonly<{ cols: number; width: number }>) {
  const cellWidth = (width - 16 * (cols - 1)) / cols;
  const pitch = cellWidth + 16;
  const image = (fill: string) => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${pitch}' height='71'><rect width='${cellWidth}' height='55' rx='6' fill='${fill}'/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  };
  return (
    <>
      <div
        aria-hidden="true"
        className="miot-dashboard-grid__overlay miot-dashboard-grid__overlay--light"
        style={{
          backgroundImage: image("rgba(0,0,0,0.06)"),
          backgroundSize: `${pitch}px 71px`,
        }}
      />
      <div
        aria-hidden="true"
        className="miot-dashboard-grid__overlay miot-dashboard-grid__overlay--dark"
        style={{
          backgroundImage: image("rgba(55,65,81,0.25)"),
          backgroundSize: `${pitch}px 71px`,
        }}
      />
    </>
  );
}
