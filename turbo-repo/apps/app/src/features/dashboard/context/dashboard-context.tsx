"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  type PropsWithChildren,
} from "react";
import { useDashboardStorage } from "../hooks/use-dashboard-storage";
import {
  type Widget,
  type GridLayoutItem,
  type DashboardStorageSchema,
  type DashboardFilterParam,
  type PlannerRequestDefinition,
  type RefreshInterval,
} from "../types/dashboard.types";
import { getDashlet, canNestIn, getDefaultContainerVariant } from "../dashlets";
import { getNextPosition } from "../utils/get-next-position";
import { PlannerProvider } from "./planner-context";
import { DashboardFiltersProvider } from "./dashboard-filters-context";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { useKioskMode } from "@/features/layout/hooks/use-kiosk-mode";

/** Context value type */
interface DashboardContextValue {
  /** All root-level widgets */
  widgets: Widget[];
  /** Whether edit mode is active */
  editMode: boolean;
  /** Whether kiosk (fullscreen) mode is active via ?kiosk=true */
  isKiosk: boolean;
  /** Whether data has loaded from storage */
  isLoaded: boolean;
  /** Dictionary for internationalization */
  dictionary: I18nRecord;
  /** Alfresco site short name (when available) */
  siteId?: string | null;
  /** Dashboard filter bar configuration */
  filters: DashboardFilterParam[];
  /** Update dashboard filter configuration */
  setFilters: (filters: DashboardFilterParam[]) => void;
  /** Auto-refresh interval in seconds (0 = off) */
  refreshInterval: RefreshInterval;
  /** Update auto-refresh interval */
  setRefreshInterval: (interval: RefreshInterval) => void;

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
  duplicateWidget: (widgetId: string) => Widget | null;

  // Utility
  findWidget: (widgetId: string) => Widget | undefined;

  // Preferences
  toggleEditMode: () => void;
  setEditMode: (value: boolean) => void;

  // Dashboard name
  dashboardName: string;
  setDashboardName: (name: string) => void;

  // Import/Export
  exportDashboard: () => string;
  importDashboard: (jsonString: string) => { success: boolean; error?: string };
  downloadDashboard: () => void;

  // Request Planner
  plannerDefinitions: PlannerRequestDefinition[];
  addPlannerRequest: (def: Omit<PlannerRequestDefinition, "id">) => string;
  updatePlannerRequest: (id: string, partial: Partial<PlannerRequestDefinition>) => void;
  removePlannerRequest: (id: string) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

/** Generate a UUID */
function generateId(): string {
  return crypto.randomUUID();
}


interface DashboardProviderProps extends PropsWithChildren {
  dictionary: I18nRecord;
  /** Dashboard slug (e.g. "dashboard", "maintenanceStatus") */
  slug: string;
  /** Optional server-loaded default config. */
  defaultConfig?: DashboardStorageSchema | null;
  /** Optional Alfresco site short name. When provided, configs are fetched from and persisted to Alfresco. */
  siteId?: string | null;
}

export function DashboardProvider({
  children,
  dictionary,
  slug,
  defaultConfig,
  siteId,
}: Readonly<DashboardProviderProps>) {
  const {
    widgets,
    filters,
    preferences,
    dashboardName,
    refreshInterval,
    isLoaded,
    addWidget: addWidgetStorage,
    addChildWidget,
    updateWidgetConfig: updateConfigStorage,
    updateWidgetLayouts: updateLayoutsStorage,
    deleteWidget: deleteWidgetStorage,
    duplicateWidget: duplicateWidgetStorage,
    setEditMode: setEditModeStorage,
    setDashboardName: setDashboardNameStorage,
    setFilters,
    setRefreshInterval,
    findWidget,
    exportDashboard,
    importDashboard,
    downloadDashboard,
    plannerDefinitions,
    addPlannerRequest,
    updatePlannerRequest,
    removePlannerRequest,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useDashboardStorage(slug, defaultConfig, siteId);

  const isKiosk = useKioskMode();

  // Force edit mode off in kiosk mode
  useEffect(() => {
    if (isKiosk && preferences.editMode) {
      setEditModeStorage(false);
    }
  }, [isKiosk, preferences.editMode, setEditModeStorage]);

  // In kiosk mode, default to 30s refresh without persisting the change
  const effectiveRefreshInterval = isKiosk && refreshInterval === 0 ? 30 : refreshInterval;

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

  const duplicateWidget = useCallback(
    (widgetId: string): Widget | null => {
      return duplicateWidgetStorage(widgetId);
    },
    [duplicateWidgetStorage]
  );

  const toggleEditMode = useCallback(() => {
    if (isKiosk) return;
    setEditModeStorage(!preferences.editMode);
  }, [isKiosk, preferences.editMode, setEditModeStorage]);

  const setEditMode = useCallback(
    (value: boolean) => {
      if (isKiosk && value) return;
      setEditModeStorage(value);
    },
    [isKiosk, setEditModeStorage]
  );

  const setDashboardName = useCallback(
    (name: string) => {
      setDashboardNameStorage(name);
    },
    [setDashboardNameStorage]
  );

  const value: DashboardContextValue = useMemo(
    () => ({
      widgets,
      editMode: preferences.editMode,
      isKiosk,
      isLoaded,
      dictionary,
      siteId,
      filters,
      setFilters,
      refreshInterval: effectiveRefreshInterval,
      setRefreshInterval,
      dashboardName,
      createWidget,
      updateWidgetConfig,
      updateWidgetLayouts,
      updateWidgetConstraints,
      deleteWidget,
      duplicateWidget,
      findWidget,
      toggleEditMode,
      setEditMode,
      setDashboardName,
      exportDashboard,
      importDashboard,
      downloadDashboard,
      plannerDefinitions,
      addPlannerRequest,
      updatePlannerRequest,
      removePlannerRequest,
      undo,
      redo,
      canUndo,
      canRedo,
    }),
    [
      widgets,
      preferences.editMode,
      isKiosk,
      isLoaded,
      dictionary,
      siteId,
      filters,
      setFilters,
      effectiveRefreshInterval,
      setRefreshInterval,
      dashboardName,
      createWidget,
      updateWidgetConfig,
      updateWidgetLayouts,
      updateWidgetConstraints,
      deleteWidget,
      duplicateWidget,
      findWidget,
      toggleEditMode,
      setEditMode,
      setDashboardName,
      exportDashboard,
      importDashboard,
      downloadDashboard,
      plannerDefinitions,
      addPlannerRequest,
      updatePlannerRequest,
      removePlannerRequest,
      undo,
      redo,
      canUndo,
      canRedo,
    ]
  );

  return (
    <DashboardContext.Provider value={value}>
      <DashboardFiltersProvider>
        <PlannerProvider>{children}</PlannerProvider>
      </DashboardFiltersProvider>
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
