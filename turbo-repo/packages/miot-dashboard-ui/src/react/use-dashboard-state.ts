"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import {
  GRID_COLS,
  type Widget,
  type DashboardStorageSchema,
  type DashboardFilterParam,
  type DashboardQueryDefinition,
  type PlannerRequestDefinition,
  type RefreshInterval,
} from "@microboxlabs/miot-dashboard-contract/document";
import { validateDashboardConfig, dashboardQueryDefinitionSchema } from "@microboxlabs/miot-dashboard-contract/schema";
import { getNextPosition } from "../core/get-next-position";
import { generalSettingsSchema, type DashboardGeneralSettingsValue } from "./general-settings-value";
import { useUndoRedo } from "./use-undo-redo";

export type WidgetDefaultResolver = (
  id: string,
) => { defaultConfig: Record<string, unknown> } | undefined;
const noDefaults: WidgetDefaultResolver = () => undefined;

/**
 * Ensure widget has all required fields with defaults
 */
export function ensureWidgetDefaults(
  widget: Widget,
  index: number,
  resolveDashlet: WidgetDefaultResolver = noDefaults,
): Widget {
  const dashlet = resolveDashlet(widget.componentId);
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
      ensureWidgetDefaults(child, i, resolveDashlet),
    ),
  };
}

type LayoutItem = { i: string; x: number; y: number; w: number; h: number };

/**
 * Apply layout update to a single widget if matching layout found
 */
export function applyLayoutToWidget(
  widget: Widget,
  layouts: LayoutItem[],
): Widget {
  const layout = layouts.find((l) => l.i === widget.id);
  if (layout) {
    const current = widget.layout;
    if (
      current.i === layout.i &&
      current.x === layout.x &&
      current.y === layout.y &&
      current.w === layout.w &&
      current.h === layout.h
    )
      return widget;
    return {
      ...widget,
      layout: { ...current, ...layout },
      updatedAt: new Date().toISOString(),
    };
  }
  return widget;
}

/**
 * Update children layouts for a specific parent widget
 */
export function updateChildrenLayouts(
  widget: Widget,
  parentId: string,
  layouts: LayoutItem[],
): Widget {
  if (widget.id === parentId && widget.children) {
    const updatedChildren = widget.children.map((child) =>
      applyLayoutToWidget(child, layouts),
    );
    if (
      updatedChildren.every(
        (child, index) => child === widget.children?.[index],
      )
    )
      return widget;
    return {
      ...widget,
      children: updatedChildren,
      updatedAt: new Date().toISOString(),
    };
  }
  if (widget.children) {
    const children = widget.children.map((w) =>
      updateChildrenLayouts(w, parentId, layouts),
    );
    return children.every((child, index) => child === widget.children?.[index])
      ? widget
      : { ...widget, children };
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
    children: widget.children?.map((child) =>
      deepCloneWidget(child, timestamp),
    ),
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
  cloned: Widget,
): Widget[] {
  return widgets.map((w) => {
    if (w.id === parentId) {
      const children = w.children ?? [];
      const sourceIndex = children.findIndex((c) => c.id === sourceId);
      const newChildren = [...children];
      newChildren.splice(sourceIndex + 1, 0, cloned);
      return {
        ...w,
        children: newChildren,
        updatedAt: new Date().toISOString(),
      };
    }
    if (w.children) {
      return {
        ...w,
        children: insertClonedAfterSource(
          w.children,
          parentId,
          sourceId,
          cloned,
        ),
      };
    }
    return w;
  });
}

/** Coerce an unknown allowedGroups value to a clean string[] or undefined. */
function normalizeAllowedGroups(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) return undefined;
  const filtered = value
    .filter((g): g is string => typeof g === "string")
    .map((g) => g.trim())
    .filter((g) => g.length > 0);
  return filtered.length > 0 ? filtered : undefined;
}

/** Strip editMode from config before host persistence */
export function stripEphemeralState(
  data: DashboardStorageSchema,
): DashboardStorageSchema {
  return {
    ...data,
    preferences: { ...data.preferences, editMode: false },
  };
}

/** Controlled document state supplied by a host with its own persistence protocol. */
export interface DashboardStorageController {
  config: DashboardStorageSchema;
  isLoaded: boolean;
  readOnly: boolean;
  onChange: (config: DashboardStorageSchema) => void;
}

/** Controlled widget editing; persistence and permission decisions belong to the host. */
export function useDashboardState(
  controller: DashboardStorageController,
  resolveDashlet: WidgetDefaultResolver = noDefaults,
) {
  const readOnly =
    controller.readOnly !== false || controller.isLoaded !== true;
  const rawConfig = controller.config;
  // Resolved config with widget defaults applied
  const resolvedConfig = useMemo(
    () => ({
      ...rawConfig,
      widgets: rawConfig.widgets.map((w, i) =>
        ensureWidgetDefaults(w, i, resolveDashlet),
      ),
    }),
    [rawConfig, resolveDashlet],
  );

  // Keep a ref so mutation callbacks don't depend on resolvedConfig directly,
  // preventing cascading callback recreation on every widget change.
  const configRef = useRef(resolvedConfig);
  configRef.current = resolvedConfig;

  // Edit mode — ephemeral React state only
  const [editMode, setEditMode] = useState(false);

  const onChangeRef = useRef(controller.onChange);
  onChangeRef.current = controller.onChange;
  const rawSaveData = useCallback(
    (config: DashboardStorageSchema) => {
      if (!readOnly) onChangeRef.current(stripEphemeralState(config));
    },
    [readOnly],
  );
  const getCurrentConfig = useCallback(() => configRef.current, []);

  // Undo/redo history wrapping rawSaveData
  const {
    saveDataWithHistory: saveData,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
  } = useUndoRedo(getCurrentConfig, rawSaveData, readOnly);

  // Helper: update config via a transform on the current widgets.
  // Reads from configRef so mutation callbacks remain stable.
  const updateConfig = useCallback(
    (
      patch:
        | Partial<DashboardStorageSchema>
        | ((current: DashboardStorageSchema) => DashboardStorageSchema),
    ) => {
      const current = configRef.current;
      const newData =
        typeof patch === "function" ? patch(current) : { ...current, ...patch };
      if (newData !== current) saveData(newData);
      return newData;
    },
    [saveData],
  );

  // Loading state belongs to the host.
  const isLoaded = controller.isLoaded;

  // Find widget by ID (recursive search)
  const findWidget = useCallback(
    (
      widgetId: string,
      widgets: Widget[] = configRef.current.widgets,
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
    [],
  );

  // Find parent widget (recursive)
  const findParent = useCallback(
    (
      widgetId: string,
      widgets: Widget[] = configRef.current.widgets,
      parent: Widget | null = null,
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
    [],
  );

  // Add a widget at root level
  const addWidget = useCallback(
    (widget: Widget) => {
      updateConfig((c) => ({ ...c, widgets: [...c.widgets, widget] }));
      return widget;
    },
    [updateConfig],
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
    [updateConfig],
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
    [updateConfig],
  );

  // Update widget layouts (for drag/drop/resize)
  const updateWidgetLayouts = useCallback(
    (
      parentId: string | null,
      layouts: { i: string; x: number; y: number; w: number; h: number }[],
    ) => {
      updateConfig((c) => {
        const widgets = c.widgets.map((widget) =>
          parentId === null
            ? applyLayoutToWidget(widget, layouts)
            : updateChildrenLayouts(widget, parentId, layouts),
        );
        return widgets.every((widget, index) => widget === c.widgets[index])
          ? c
          : { ...c, widgets };
      });
    },
    [updateConfig],
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
    [updateConfig],
  );

  // Duplicate a widget (deep-clone with new UUIDs, place adjacent)
  const duplicateWidget = useCallback(
    (widgetId: string): Widget | null => {
      const source = findWidget(widgetId);
      if (!source) return null;

      const cloned = deepCloneWidget(source);
      const parent = findParent(widgetId);

      // Position clone adjacent to the original; containers clamp via react-grid-layout
      const siblings = parent
        ? (parent.children ?? [])
        : configRef.current.widgets;
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
          widgets: insertClonedAfterSource(
            c.widgets,
            parent.id,
            widgetId,
            cloned,
          ),
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
    [findWidget, findParent, updateConfig],
  );

  const setGeneralSettings = useCallback((value: DashboardGeneralSettingsValue): boolean => {
    if (readOnly) return false;
    const parsed = generalSettingsSchema.safeParse(value);
    if (!parsed.success) return false;
    updateConfig({ ...parsed.data, order: parsed.data.order });
    return true;
  }, [readOnly, updateConfig]);

  // Set dashboard name
  const setDashboardName = useCallback(
    (name: string) => {
      updateConfig({ name });
    },
    [updateConfig],
  );

  // ── Filters CRUD ─────────────────────────────────────────────────────────

  const setFilters = useCallback(
    (filters: DashboardFilterParam[]) => {
      updateConfig({ filters });
    },
    [updateConfig],
  );

  /** Commit valid named queries through the same permission and undo boundary as widgets. */
  const setQueries = useCallback((queries: readonly DashboardQueryDefinition[]): boolean => {
    if (readOnly) return false;
    const parsed = dashboardQueryDefinitionSchema.array().max(50).safeParse(queries);
    if (!parsed.success) return false;
    const ids = new Set(parsed.data.map(query => query.id));
    const names = new Set(parsed.data.map(query => query.variableName));
    if (ids.size !== parsed.data.length || names.size !== parsed.data.length) return false;
    updateConfig({ queries: parsed.data });
    return true;
  }, [readOnly, updateConfig]);

  const setRefreshInterval = useCallback(
    (refreshInterval: RefreshInterval) => {
      updateConfig({ refreshInterval });
    },
    [updateConfig],
  );

  const setOrder = useCallback(
    (order: number) => {
      updateConfig({ order });
    },
    [updateConfig],
  );

  const setAllowedGroups = useCallback(
    (allowedGroups: string[]) => {
      updateConfig({ allowedGroups });
    },
    [updateConfig],
  );

  // ── Planner CRUD ──────────────────────────────────────────────────────────

  const getPlannerDefinitions = useCallback(
    (): PlannerRequestDefinition[] => configRef.current.requestPlanner ?? [],
    [],
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
    [updateConfig],
  );

  const updatePlannerRequest = useCallback(
    (id: string, partial: Partial<PlannerRequestDefinition>) => {
      updateConfig((c) => ({
        ...c,
        requestPlanner: (c.requestPlanner ?? []).map((r) =>
          r.id === id ? { ...r, ...partial } : r,
        ),
      }));
    },
    [updateConfig],
  );

  const removePlannerRequest = useCallback(
    (id: string) => {
      updateConfig((c) => ({
        ...c,
        requestPlanner: (c.requestPlanner ?? []).filter((r) => r.id !== id),
      }));
    },
    [updateConfig],
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
      if (readOnly) return { success: false, error: "Dashboard is read-only" };
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

        if (parsed.version !== 2) {
          return {
            success: false,
            error: `Unsupported version: ${parsed.version}`,
          };
        }
        const validation = validateDashboardConfig(parsed);
        if (!validation.valid)
          return { success: false, error: "Invalid dashboard format" };
        const imported = validation.config;
        const newData: DashboardStorageSchema = {
          ...imported,
          widgets: imported.widgets.map((widget, index) =>
            ensureWidgetDefaults(widget, index, resolveDashlet),
          ),
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
    [clearHistory, rawSaveData, readOnly, resolveDashlet],
  );

  return {
    widgets: resolvedConfig.widgets,
    filters: resolvedConfig.filters ?? [],
    queries: resolvedConfig.queries ?? [],
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
    setGeneralSettings,
    setFilters,
    setQueries,
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
