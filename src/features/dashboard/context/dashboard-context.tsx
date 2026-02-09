"use client";

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type PropsWithChildren,
} from "react";
import { useDashboardStorage } from "../hooks/use-dashboard-storage";
import type { Widget, GridLayoutItem } from "../types/dashboard.types";
import { getDashlet, canNestIn, getDefaultContainerVariant } from "../dashlets";

/** Context value type */
interface DashboardContextValue {
  /** All root-level widgets */
  widgets: Widget[];
  /** Whether edit mode is active */
  editMode: boolean;
  /** Whether data has loaded from storage */
  isLoaded: boolean;

  // Widget actions
  createWidget: (
    componentId: string,
    parentId?: string | null,
    configOverride?: Record<string, unknown>
  ) => Widget | null;
  updateWidgetConfig: (
    widgetId: string,
    config: Record<string, unknown>
  ) => void;
  updateWidgetLayouts: (
    parentId: string | null,
    layouts: GridLayoutItem[]
  ) => void;
  updateWidgetConstraints: (
    widgetId: string,
    constraints: { minW?: number; minH?: number; maxW?: number; maxH?: number }
  ) => void;
  deleteWidget: (widgetId: string) => void;

  // Utility
  findWidget: (widgetId: string) => Widget | undefined;

  // Preferences
  toggleEditMode: () => void;
  setEditMode: (value: boolean) => void;

  // Import/Export
  exportDashboard: () => string;
  importDashboard: (jsonString: string) => { success: boolean; error?: string };
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

/** Generate a UUID */
function generateId(): string {
  return crypto.randomUUID();
}

/** Calculate next available position in the grid */
function getNextPosition(
  children: Widget[],
  width: number = 1
): { x: number; y: number } {
  if (children.length === 0) {
    return { x: 0, y: 0 };
  }

  // Find the maximum y + h (bottom of grid)
  let maxBottom = 0;
  let maxBottomRowEndX = 0;

  for (const widget of children) {
    const bottom = widget.layout.y + widget.layout.h;
    if (bottom > maxBottom) {
      maxBottom = bottom;
    }
    if (bottom === maxBottom) {
      maxBottomRowEndX = Math.max(
        maxBottomRowEndX,
        widget.layout.x + widget.layout.w
      );
    }
  }

  // Check if we can fit in the last row
  const lastRowY = maxBottom - 1;
  const widgetsInLastRow = children.filter(
    (w) => w.layout.y <= lastRowY && w.layout.y + w.layout.h > lastRowY
  );

  let usedColumns = 0;
  for (const w of widgetsInLastRow) {
    usedColumns = Math.max(usedColumns, w.layout.x + w.layout.w);
  }

  if (usedColumns + width <= 3) {
    return { x: usedColumns, y: lastRowY };
  }

  // Start new row
  return { x: 0, y: maxBottom };
}

export function DashboardProvider({ children }: PropsWithChildren) {
  const {
    widgets,
    preferences,
    isLoaded,
    addWidget: addWidgetStorage,
    addChildWidget,
    updateWidgetConfig: updateConfigStorage,
    updateWidgetLayouts: updateLayoutsStorage,
    deleteWidget: deleteWidgetStorage,
    setEditMode: setEditModeStorage,
    findWidget,
    exportDashboard,
    importDashboard,
  } = useDashboardStorage();

  const createWidget = useCallback(
    (
      componentId: string,
      parentId?: string | null,
      configOverride?: Record<string, unknown>
    ): Widget | null => {
      // Get parent's componentId for nesting validation
      let parentComponentId: string | null = null;
      let parentConfig: Record<string, unknown> | undefined;
      if (parentId) {
        const parent = findWidget(parentId);
        if (!parent) {
          console.error(`Parent widget not found: ${parentId}`);
          return null;
        }
        parentComponentId = parent.componentId;
        parentConfig = parent.config;
      }

      // Build the config with context-aware defaults for containers
      let widgetConfig = configOverride ?? {};
      if (componentId === "container" && !("variant" in widgetConfig)) {
        widgetConfig = {
          ...widgetConfig,
          variant: getDefaultContainerVariant(parentComponentId),
        };
      }

      // Validate nesting rules with variant
      const childVariant =
        componentId === "container"
          ? (widgetConfig.variant as "bento-box" | "labeled-group" | undefined)
          : undefined;
      if (
        !canNestIn(componentId, parentComponentId, childVariant, parentConfig)
      ) {
        console.error(
          `Cannot nest ${componentId} in ${parentComponentId ?? "root"}`
        );
        return null;
      }

      const dashlet = getDashlet(componentId);
      if (!dashlet) {
        console.error(`Unknown dashlet: ${componentId}`);
        return null;
      }

      const now = new Date().toISOString();
      const id = generateId();

      const layoutDefaults = dashlet.getLayoutDefaults(widgetConfig);
      const defaultSize = {
        minW: Math.max(1, layoutDefaults.minW),
        minH: Math.max(1, layoutDefaults.minH),
      };

      // Determine position based on siblings
      let position = { x: 0, y: 0 };
      if (parentId) {
        const parent = findWidget(parentId);
        if (parent?.children) {
          position = getNextPosition(parent.children, defaultSize.minW);
        }
      } else {
        position = getNextPosition(widgets, defaultSize.minW);
      }

      const newWidget: Widget = {
        id,
        componentId,
        layout: {
          i: id,
          x: position.x,
          y: position.y,
          w: defaultSize.minW,
          h: defaultSize.minH,
          minW: defaultSize.minW,
          minH: defaultSize.minH,
        },
        config: { ...dashlet.defaultConfig, ...widgetConfig },
        children: dashlet.meta.hasChildren ? [] : undefined,
        createdAt: now,
        updatedAt: now,
      };

      if (parentId) {
        return addChildWidget(parentId, newWidget);
      } else {
        return addWidgetStorage(newWidget);
      }
    },
    [widgets, findWidget, addWidgetStorage, addChildWidget]
  );

  const updateWidgetConfig = useCallback(
    (widgetId: string, config: Record<string, unknown>) => {
      updateConfigStorage(widgetId, config);
    },
    [updateConfigStorage]
  );

  const updateWidgetLayouts = useCallback(
    (parentId: string | null, layouts: GridLayoutItem[]) => {
      updateLayoutsStorage(parentId, layouts);
    },
    [updateLayoutsStorage]
  );

  const updateWidgetConstraints = useCallback(
    (
      widgetId: string,
      constraints: {
        minW?: number;
        minH?: number;
        maxW?: number;
        maxH?: number;
      }
    ) => {
      // Find the widget and its parent
      const widget = findWidget(widgetId);
      if (!widget) return;

      // Find the parent that contains this widget
      const findParentId = (
        widgetList: Widget[],
        targetId: string,
        parentId: string | null = null
      ): string | null | undefined => {
        for (const w of widgetList) {
          if (w.id === targetId) return parentId;
          if (w.children) {
            const found = findParentId(w.children, targetId, w.id);
            if (found !== undefined) return found;
          }
        }
        return undefined;
      };

      const parentId = findParentId(widgets, widgetId);

      // Update the layout with new constraints
      const updatedLayout: GridLayoutItem = {
        ...widget.layout,
        ...constraints,
      };

      updateLayoutsStorage(parentId ?? null, [updatedLayout]);
    },
    [widgets, findWidget, updateLayoutsStorage]
  );

  const deleteWidget = useCallback(
    (widgetId: string) => {
      deleteWidgetStorage(widgetId);
    },
    [deleteWidgetStorage]
  );

  const toggleEditMode = useCallback(() => {
    setEditModeStorage(!preferences.editMode);
  }, [preferences.editMode, setEditModeStorage]);

  const setEditMode = useCallback(
    (value: boolean) => {
      setEditModeStorage(value);
    },
    [setEditModeStorage]
  );

  const value: DashboardContextValue = useMemo(
    () => ({
      widgets,
      editMode: preferences.editMode,
      isLoaded,
      createWidget,
      updateWidgetConfig,
      updateWidgetLayouts,
      updateWidgetConstraints,
      deleteWidget,
      findWidget,
      toggleEditMode,
      setEditMode,
      exportDashboard,
      importDashboard,
    }),
    [
      widgets,
      preferences.editMode,
      isLoaded,
      createWidget,
      updateWidgetConfig,
      updateWidgetLayouts,
      updateWidgetConstraints,
      deleteWidget,
      findWidget,
      toggleEditMode,
      setEditMode,
      exportDashboard,
      importDashboard,
    ]
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
