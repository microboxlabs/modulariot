"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type Widget,
  type DashboardStorageSchema,
  DEFAULT_STORAGE,
  STORAGE_KEY,
} from "../types/dashboard.types";
import { getDashlet } from "../dashlets";

/**
 * Ensure widget has all required fields with defaults
 */
function ensureWidgetDefaults(widget: Widget, index: number): Widget {
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
function applyLayoutToWidget(widget: Widget, layouts: LayoutItem[]): Widget {
  const layout = layouts.find((l) => l.i === widget.id);
  if (layout) {
    return { ...widget, layout, updatedAt: new Date().toISOString() };
  }
  return widget;
}

/**
 * Update children layouts for a specific parent widget
 */
function updateChildrenLayouts(
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
 * Hook for persisting dashboard data to localStorage
 */
export function useDashboardStorage() {
  const [data, setData] = useState<DashboardStorageSchema>(DEFAULT_STORAGE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.version === 2) {
          // Current version - ensure defaults
          const migratedWidgets = parsed.widgets.map((w: Widget, i: number) =>
            ensureWidgetDefaults(w, i)
          );
          // Ensure name exists (migration for existing dashboards without name)
          const name = parsed.name || DEFAULT_STORAGE.name;
          setData({ ...parsed, name, widgets: migratedWidgets });
        } else {
          // Unknown version - reset to defaults
          setData(DEFAULT_STORAGE);
        }
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      setData(DEFAULT_STORAGE);
    }
    setIsLoaded(true);
  }, []);

  // Save data to localStorage
  const saveData = useCallback((newData: DashboardStorageSchema) => {
    setData(newData);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (error) {
      console.error("Failed to save dashboard data:", error);
    }
  }, []);

  // Find widget by ID (recursive search)
  const findWidget = useCallback(
    (
      widgetId: string,
      widgets: Widget[] = data.widgets
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
    [data.widgets]
  );

  // Find parent widget (recursive)
  // Returns undefined if widget not found, null if widget is at root level
  const findParent = useCallback(
    (
      widgetId: string,
      widgets: Widget[] = data.widgets,
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
    [data.widgets]
  );

  // Add a widget at root level
  const addWidget = useCallback(
    (widget: Widget) => {
      const newData: DashboardStorageSchema = {
        ...data,
        widgets: [...data.widgets, widget],
      };
      saveData(newData);
      return widget;
    },
    [data, saveData]
  );

  // Add a widget as child of another widget
  const addChildWidget = useCallback(
    (parentId: string, widget: Widget) => {
      const updateChildren = (widgets: Widget[]): Widget[] =>
        widgets.map((w) => {
          if (w.id === parentId) {
            return {
              ...w,
              children: [...(w.children ?? []), widget],
              updatedAt: new Date().toISOString(),
            };
          }
          if (w.children) {
            return { ...w, children: updateChildren(w.children) };
          }
          return w;
        });

      const newData: DashboardStorageSchema = {
        ...data,
        widgets: updateChildren(data.widgets),
      };
      saveData(newData);
      return widget;
    },
    [data, saveData]
  );

  // Update a widget's config
  const updateWidgetConfig = useCallback(
    (widgetId: string, config: Record<string, unknown>) => {
      const updateInTree = (widgets: Widget[]): Widget[] =>
        widgets.map((w) => {
          if (w.id === widgetId) {
            return {
              ...w,
              config,
              updatedAt: new Date().toISOString(),
            };
          }
          if (w.children) {
            return { ...w, children: updateInTree(w.children) };
          }
          return w;
        });

      const newData: DashboardStorageSchema = {
        ...data,
        widgets: updateInTree(data.widgets),
      };
      saveData(newData);
    },
    [data, saveData]
  );

  // Update widget layouts (for drag/drop/resize)
  const updateWidgetLayouts = useCallback(
    (
      parentId: string | null,
      layouts: { i: string; x: number; y: number; w: number; h: number }[]
    ) => {
      // If parentId is null, update root-level widgets
      if (parentId === null) {
        const updatedWidgets = data.widgets.map((widget) =>
          applyLayoutToWidget(widget, layouts)
        );

        const newData: DashboardStorageSchema = {
          ...data,
          widgets: updatedWidgets,
        };
        saveData(newData);
        return;
      }

      // Otherwise update children of a specific parent
      const updatedWidgets = data.widgets.map((w) =>
        updateChildrenLayouts(w, parentId, layouts)
      );

      const newData: DashboardStorageSchema = {
        ...data,
        widgets: updatedWidgets,
      };
      saveData(newData);
    },
    [data, saveData]
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

      const newData: DashboardStorageSchema = {
        ...data,
        widgets: removeFromTree(data.widgets),
      };
      saveData(newData);
    },
    [data, saveData]
  );

  // Set edit mode
  const setEditMode = useCallback(
    (editMode: boolean) => {
      const newData: DashboardStorageSchema = {
        ...data,
        preferences: { ...data.preferences, editMode },
      };
      saveData(newData);
    },
    [data, saveData]
  );

  // Set dashboard name
  const setDashboardName = useCallback(
    (name: string) => {
      const newData: DashboardStorageSchema = {
        ...data,
        name,
      };
      saveData(newData);
    },
    [data, saveData]
  );

  // Download dashboard as JSON file
  const downloadDashboard = useCallback(() => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.name.replace(/\s+/g, "_").toLowerCase()}_dashboard.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [data]);

  // Export dashboard as JSON string
  const exportDashboard = useCallback((): string => {
    return JSON.stringify(data, null, 2);
  }, [data]);

  // Import dashboard from JSON string
  const importDashboard = useCallback(
    (jsonString: string): { success: boolean; error?: string } => {
      try {
        const parsed = JSON.parse(jsonString) as unknown;

        // Validate basic structure
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          !("version" in parsed) ||
          !("widgets" in parsed)
        ) {
          return { success: false, error: "Invalid dashboard format" };
        }

        const imported = parsed as DashboardStorageSchema;

        // Check version
        if (imported.version !== 2) {
          return {
            success: false,
            error: `Unsupported version: ${imported.version}`,
          };
        }

        // Ensure all widgets have proper defaults
        const normalizedWidgets = imported.widgets.map((widget, index) =>
          ensureWidgetDefaults(widget, index)
        );

        const newData: DashboardStorageSchema = {
          version: 2,
          name: imported.name || DEFAULT_STORAGE.name,
          widgets: normalizedWidgets,
          preferences: imported.preferences ?? { editMode: false },
        };

        saveData(newData);
        return { success: true };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "Failed to parse JSON",
        };
      }
    },
    [saveData]
  );

  return {
    widgets: data.widgets,
    preferences: data.preferences,
    dashboardName: data.name,
    isLoaded,
    addWidget,
    addChildWidget,
    updateWidgetConfig,
    updateWidgetLayouts,
    deleteWidget,
    setEditMode,
    setDashboardName,
    findWidget,
    findParent,
    exportDashboard,
    importDashboard,
    downloadDashboard,
  };
}
