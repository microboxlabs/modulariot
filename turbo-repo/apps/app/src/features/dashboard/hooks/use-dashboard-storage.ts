"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import useSWR from "swr";
import fetcher from "@/features/common/providers/fetcher";
import {
  GRID_COLS,
  type Widget,
  type DashboardStorageSchema,
  type DashboardFilterParam,
  type PlannerRequestDefinition,
  type RefreshInterval,
  DEFAULT_STORAGE,
} from "../types/dashboard.types";
import { getDashlet } from "../dashlets";
import { useUndoRedo } from "./use-undo-redo";
import { getNextPosition } from "../utils/get-next-position";

/**
 * Ensure widget has all required fields with defaults
 */
export function ensureWidgetDefaults(widget: Widget, index: number): Widget {
  const dashlet = getDashlet(widget.componentId);
  const defaultConfig = dashlet?.defaultConfig ?? {};

  return {
    ...widget,
    layout: widget.layout ?? {
      i: widget.id,
      x: index % 3,
      y: Math.floor(index / 3),
      w: 1,
      h: 1,
    },
    config: { ...defaultConfig, ...widget.config },
    children: widget.children?.map((child, i) =>
      ensureWidgetDefaults(child, i)
    ),
  };
}

type LayoutItem = { i: string; x: number; y: number; w: number; h: number };

/**
 * Apply layout update to a single widget if matching layout found
 */
export function applyLayoutToWidget(widget: Widget, layouts: LayoutItem[]): Widget {
  const layout = layouts.find((l) => l.i === widget.id);
  if (layout) {
    return { ...widget, layout, updatedAt: new Date().toISOString() };
  }
  return widget;
}

/**
 * Update children layouts for a specific parent widget
 */
export function updateChildrenLayouts(
  widget: Widget,
  parentId: string,
  layouts: LayoutItem[]
): Widget {
  if (widget.id === parentId && widget.children) {
    const updatedChildren = widget.children.map((child) =>
      applyLayoutToWidget(child, layouts)
    );
    return {
      ...widget,
      children: updatedChildren,
      updatedAt: new Date().toISOString(),
    };
  }
  if (widget.children) {
    return {
      ...widget,
      children: widget.children.map((w) =>
        updateChildrenLayouts(w, parentId, layouts)
      ),
    };
  }
  return widget;
}

/**
 * Deep-clone a widget tree, regenerating UUIDs and timestamps.
 * A single timestamp is shared across the entire cloned subtree.
 */
function deepCloneWidget(widget: Widget, now?: string): Widget {
  const timestamp = now ?? new Date().toISOString();
  const newId = crypto.randomUUID();
  return {
    ...widget,
    id: newId,
    layout: { ...widget.layout, i: newId },
    config: structuredClone(widget.config),
    children: widget.children?.map((child) => deepCloneWidget(child, timestamp)),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Insert `cloned` widget right after the widget with `sourceId` inside
 * the subtree rooted at `parentId`.  Returns a new widget array (immutable).
 */
function insertClonedAfterSource(
  widgets: Widget[],
  parentId: string,
  sourceId: string,
  cloned: Widget
): Widget[] {
  return widgets.map((w) => {
    if (w.id === parentId) {
      const children = w.children ?? [];
      const sourceIndex = children.findIndex((c) => c.id === sourceId);
      const newChildren = [...children];
      newChildren.splice(sourceIndex + 1, 0, cloned);
      return { ...w, children: newChildren, updatedAt: new Date().toISOString() };
    }
    if (w.children) {
      return { ...w, children: insertClonedAfterSource(w.children, parentId, sourceId, cloned) };
    }
    return w;
  });
}

/** Coerce an unknown allowedGroups value to a clean string[] or undefined. */
function normalizeAllowedGroups(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) return undefined;
  const filtered = value.filter((g): g is string => typeof g === "string");
  return filtered.length > 0 ? filtered : undefined;
}

/** Strip editMode from config before persisting to Alfresco */
export function stripEphemeralState(
  data: DashboardStorageSchema
): DashboardStorageSchema {
  return {
    ...data,
    preferences: { ...data.preferences, editMode: false },
  };
}

const ALFRESCO_DEBOUNCE_MS = 2000;
const ALFRESCO_MAX_RETRIES = 3;
const ALFRESCO_RETRY_BASE_MS = 1000;

/**
 * Hook for persisting dashboard data via SWR + Alfresco.
 * @param slug          - Dashboard slug (e.g. "dashboard", "maintenanceStatus")
 * @param defaultConfig - Optional server-loaded default config.
 * @param siteId        - Optional Alfresco site short name. When provided, configs
 *                        are fetched from and persisted to Alfresco.
 */
export function useDashboardStorage(
  slug: string,
  defaultConfig?: DashboardStorageSchema | null,
  siteId?: string | null
) {
  // Stabilize fallback via ref — defaultConfig comes from server props and is
  // referentially stable per page load, but we guard against inline objects.
  const fallbackRef = useRef(defaultConfig ?? DEFAULT_STORAGE);

  // SWR key — null when no siteId (disables fetch)
  const swrKey = siteId
    ? `/app/api/dashboard/config?site=${encodeURIComponent(siteId)}&slug=${encodeURIComponent(slug)}`
    : null;

  const { data: response, mutate, isLoading } = useSWR<{ data: DashboardStorageSchema | null }>(
    swrKey,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
      fallbackData: { data: fallbackRef.current },
    }
  );

  const rawConfig = response?.data ?? fallbackRef.current;

  // Resolved config with widget defaults applied
  const resolvedConfig = useMemo(() => ({
    ...rawConfig,
    widgets: rawConfig.widgets.map((w, i) => ensureWidgetDefaults(w, i)),
  }), [rawConfig]);

  // Keep a ref so mutation callbacks don't depend on resolvedConfig directly,
  // preventing cascading callback recreation on every widget change.
  const configRef = useRef(resolvedConfig);
  configRef.current = resolvedConfig;

  // Edit mode — ephemeral React state only
  const [editMode, setEditMode] = useState(false);

  // Refs for debounced Alfresco save
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<DashboardStorageSchema | null>(null);
  const siteIdRef = useRef(siteId);
  siteIdRef.current = siteId;

  /** Save config to Alfresco with retry */
  const saveToAlfresco = useCallback(
    async (configData: DashboardStorageSchema, retryCount = 0) => {
      const currentSiteId = siteIdRef.current;
      if (!currentSiteId) return;

      try {
        const res = await fetch("/app/api/dashboard/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            site: currentSiteId,
            slug,
            config: stripEphemeralState(configData),
          }),
        });

        if (!res.ok) {
          throw new Error(`Alfresco save failed: ${res.status}`);
        }
      } catch (error) {
        if (retryCount < ALFRESCO_MAX_RETRIES - 1) {
          const delay =
            ALFRESCO_RETRY_BASE_MS * Math.pow(2, retryCount);
          console.warn(
            `Alfresco save failed, retrying in ${delay}ms (attempt ${retryCount + 2}/${ALFRESCO_MAX_RETRIES})`,
            error
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          return saveToAlfresco(configData, retryCount + 1);
        }
        console.error(
          "Failed to save dashboard config to Alfresco after retries:",
          error
        );
      }
    },
    [slug]
  );

  /** Schedule a debounced Alfresco save */
  const scheduleSaveToAlfresco = useCallback(
    (configData: DashboardStorageSchema) => {
      if (!siteIdRef.current) return;

      pendingSaveRef.current = configData;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const pending = pendingSaveRef.current;
        pendingSaveRef.current = null;
        debounceTimerRef.current = null;
        if (pending) {
          void saveToAlfresco(pending);
        }
      }, ALFRESCO_DEBOUNCE_MS);
    },
    [saveToAlfresco]
  );

  // Flush pending Alfresco save on unmount using keepalive fetch
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const pending = pendingSaveRef.current;
      const currentSiteId = siteIdRef.current;
      pendingSaveRef.current = null;
      if (pending && currentSiteId) {
        // Raw fetch with keepalive for page teardown — shared fetcher doesn't support keepalive
        fetch("/app/api/dashboard/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            site: currentSiteId,
            slug,
            config: stripEphemeralState(pending),
          }),
          keepalive: true,
        }).catch(() => {
          // Best-effort flush
        });
      }
    };
  }, [slug]);

  // Raw save: optimistic SWR mutate + debounced Alfresco PUT (no history)
  const rawSaveData = useCallback(
    (newData: DashboardStorageSchema) => {
      void mutate({ data: newData }, { revalidate: false });
      scheduleSaveToAlfresco(newData);
    },
    [mutate, scheduleSaveToAlfresco]
  );

  // Undo/redo history wrapping rawSaveData
  const {
    saveDataWithHistory: saveData,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  } = useUndoRedo(
    () => configRef.current,
    rawSaveData
  );

  // Helper: update config via a transform on the current widgets.
  // Reads from configRef so mutation callbacks remain stable.
  const updateConfig = useCallback(
    (patch: Partial<DashboardStorageSchema> | ((current: DashboardStorageSchema) => DashboardStorageSchema)) => {
      const current = configRef.current;
      const newData = typeof patch === "function" ? patch(current) : { ...current, ...patch };
      saveData(newData);
      return newData;
    },
    [saveData]
  );

  // isLoaded: null key means no fetch needed → immediately loaded
  const isLoaded = swrKey ? !isLoading : true;

  // Find widget by ID (recursive search)
  const findWidget = useCallback(
    (
      widgetId: string,
      widgets: Widget[] = configRef.current.widgets
    ): Widget | undefined => {
      for (const widget of widgets) {
        if (widget.id === widgetId) return widget;
        if (widget.children) {
          const found = findWidget(widgetId, widget.children);
          if (found) return found;
        }
      }
      return undefined;
    },
    []
  );

  // Find parent widget (recursive)
  const findParent = useCallback(
    (
      widgetId: string,
      widgets: Widget[] = configRef.current.widgets,
      parent: Widget | null = null
    ): Widget | null | undefined => {
      for (const widget of widgets) {
        if (widget.id === widgetId) return parent;
        if (widget.children) {
          const found = findParent(widgetId, widget.children, widget);
          if (found !== undefined) return found;
        }
      }
      return undefined;
    },
    []
  );

  // Add a widget at root level
  const addWidget = useCallback(
    (widget: Widget) => {
      updateConfig((c) => ({ ...c, widgets: [...c.widgets, widget] }));
      return widget;
    },
    [updateConfig]
  );

  // Add a widget as child of another widget
  const addChildWidget = useCallback(
    (parentId: string, widget: Widget) => {
      const addToParent = (widgets: Widget[]): Widget[] =>
        widgets.map((w) => {
          if (w.id === parentId) {
            return {
              ...w,
              children: [...(w.children ?? []), widget],
              updatedAt: new Date().toISOString(),
            };
          }
          if (w.children) {
            return { ...w, children: addToParent(w.children) };
          }
          return w;
        });

      updateConfig((c) => ({ ...c, widgets: addToParent(c.widgets) }));
      return widget;
    },
    [updateConfig]
  );

  // Update a widget's config
  const updateWidgetConfig = useCallback(
    (widgetId: string, config: Record<string, unknown>) => {
      const updateInTree = (widgets: Widget[]): Widget[] =>
        widgets.map((w) => {
          if (w.id === widgetId) {
            return { ...w, config, updatedAt: new Date().toISOString() };
          }
          if (w.children) {
            return { ...w, children: updateInTree(w.children) };
          }
          return w;
        });

      updateConfig((c) => ({ ...c, widgets: updateInTree(c.widgets) }));
    },
    [updateConfig]
  );

  // Update widget layouts (for drag/drop/resize)
  const updateWidgetLayouts = useCallback(
    (
      parentId: string | null,
      layouts: { i: string; x: number; y: number; w: number; h: number }[]
    ) => {
      updateConfig((c) => {
        if (parentId === null) {
          return { ...c, widgets: c.widgets.map((w) => applyLayoutToWidget(w, layouts)) };
        }
        return { ...c, widgets: c.widgets.map((w) => updateChildrenLayouts(w, parentId, layouts)) };
      });
    },
    [updateConfig]
  );

  // Delete a widget (and its children)
  const deleteWidget = useCallback(
    (widgetId: string) => {
      const removeFromTree = (widgets: Widget[]): Widget[] =>
        widgets
          .filter((w) => w.id !== widgetId)
          .map((w) => {
            if (w.children) {
              return { ...w, children: removeFromTree(w.children) };
            }
            return w;
          });

      updateConfig((c) => ({ ...c, widgets: removeFromTree(c.widgets) }));
    },
    [updateConfig]
  );

  // Duplicate a widget (deep-clone with new UUIDs, place adjacent)
  const duplicateWidget = useCallback(
    (widgetId: string): Widget | null => {
      const source = findWidget(widgetId);
      if (!source) return null;

      const cloned = deepCloneWidget(source);
      const parent = findParent(widgetId);

      // Position clone adjacent to the original; containers clamp via react-grid-layout
      const siblings = parent ? (parent.children ?? []) : configRef.current.widgets;
      const adjacentX = source.layout.x + source.layout.w;

      if (adjacentX + cloned.layout.w <= GRID_COLS) {
        cloned.layout.x = adjacentX;
        cloned.layout.y = source.layout.y;
      } else {
        const nextPos = getNextPosition(siblings, cloned.layout.w);
        cloned.layout.x = nextPos.x;
        cloned.layout.y = nextPos.y;
      }

      if (parent) {
        updateConfig((c) => ({
          ...c,
          widgets: insertClonedAfterSource(c.widgets, parent.id, widgetId, cloned),
        }));
      } else {
        updateConfig((c) => {
          const sourceIndex = c.widgets.findIndex((w) => w.id === widgetId);
          const newWidgets = [...c.widgets];
          newWidgets.splice(sourceIndex + 1, 0, cloned);
          return { ...c, widgets: newWidgets };
        });
      }

      return cloned;
    },
    [findWidget, findParent, updateConfig]
  );

  // Set dashboard name
  const setDashboardName = useCallback(
    (name: string) => {
      updateConfig({ name });
    },
    [updateConfig]
  );

  // ── Filters CRUD ─────────────────────────────────────────────────────────

  const setFilters = useCallback(
    (filters: DashboardFilterParam[]) => {
      updateConfig({ filters });
    },
    [updateConfig]
  );

  const setRefreshInterval = useCallback(
    (refreshInterval: RefreshInterval) => {
      updateConfig({ refreshInterval });
    },
    [updateConfig]
  );

  const setOrder = useCallback(
    (order: number) => {
      updateConfig({ order });
    },
    [updateConfig]
  );

  const setAllowedGroups = useCallback(
    (allowedGroups: string[]) => {
      updateConfig({ allowedGroups });
    },
    [updateConfig]
  );

  // ── Planner CRUD ──────────────────────────────────────────────────────────

  const getPlannerDefinitions = useCallback(
    (): PlannerRequestDefinition[] => configRef.current.requestPlanner ?? [],
    []
  );

  const addPlannerRequest = useCallback(
    (def: Omit<PlannerRequestDefinition, "id">) => {
      const id = crypto.randomUUID();
      updateConfig((c) => ({
        ...c,
        requestPlanner: [...(c.requestPlanner ?? []), { ...def, id }],
      }));
      return id;
    },
    [updateConfig]
  );

  const updatePlannerRequest = useCallback(
    (id: string, partial: Partial<PlannerRequestDefinition>) => {
      updateConfig((c) => ({
        ...c,
        requestPlanner: (c.requestPlanner ?? []).map((r) =>
          r.id === id ? { ...r, ...partial } : r
        ),
      }));
    },
    [updateConfig]
  );

  const removePlannerRequest = useCallback(
    (id: string) => {
      updateConfig((c) => ({
        ...c,
        requestPlanner: (c.requestPlanner ?? []).filter((r) => r.id !== id),
      }));
    },
    [updateConfig]
  );

  // Download dashboard as JSON file
  const downloadDashboard = useCallback(() => {
    const current = configRef.current;
    const json = JSON.stringify(current, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${current.name.replaceAll(/\s+/g, "_").toLowerCase()}_dashboard.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, []);

  // Export dashboard as JSON string
  const exportDashboard = useCallback((): string => {
    return JSON.stringify(configRef.current, null, 2);
  }, []);

  // Import dashboard from JSON string
  const importDashboard = useCallback(
    (jsonString: string): { success: boolean; error?: string } => {
      try {
        const parsed = JSON.parse(jsonString) as unknown;

        if (
          typeof parsed !== "object" ||
          parsed === null ||
          !("version" in parsed) ||
          !("widgets" in parsed)
        ) {
          return { success: false, error: "Invalid dashboard format" };
        }

        const imported = parsed as DashboardStorageSchema;

        if (imported.version !== 2) {
          return {
            success: false,
            error: `Unsupported version: ${imported.version}`,
          };
        }

        const normalizedWidgets = imported.widgets.map((widget, index) =>
          ensureWidgetDefaults(widget, index)
        );

        const newData: DashboardStorageSchema = {
          version: 2,
          name: imported.name || DEFAULT_STORAGE.name,
          widgets: normalizedWidgets,
          preferences: imported.preferences ?? { editMode: false },
          requestPlanner: imported.requestPlanner,
          filters: imported.filters,
          refreshInterval: imported.refreshInterval,
          order: imported.order,
          allowedGroups: normalizeAllowedGroups(imported.allowedGroups),
        };

        clearHistory();
        rawSaveData(newData);
        return { success: true };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "Failed to parse JSON",
        };
      }
    },
    [clearHistory, rawSaveData]
  );

  return {
    widgets: resolvedConfig.widgets,
    filters: resolvedConfig.filters ?? [],
    plannerDefinitions: resolvedConfig.requestPlanner ?? [],
    preferences: { editMode },
    dashboardName: resolvedConfig.name,
    refreshInterval: resolvedConfig.refreshInterval ?? 0,
    order: resolvedConfig.order,
    allowedGroups: normalizeAllowedGroups(resolvedConfig.allowedGroups) ?? [],
    isLoaded,
    addWidget,
    addChildWidget,
    updateWidgetConfig,
    updateWidgetLayouts,
    deleteWidget,
    duplicateWidget,
    setEditMode,
    setDashboardName,
    setFilters,
    setRefreshInterval,
    setOrder,
    setAllowedGroups,
    findWidget,
    findParent,
    exportDashboard,
    importDashboard,
    downloadDashboard,
    getPlannerDefinitions,
    addPlannerRequest,
    updatePlannerRequest,
    removePlannerRequest,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
