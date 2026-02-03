"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type Widget,
  type DashboardStorageSchema,
  type LegacyStorageSchema,
  DEFAULT_STORAGE,
  STORAGE_KEY,
  OLD_STORAGE_KEY,
} from "../types/dashboard.types";
import { getDashlet } from "../dashlets";

/**
 * Migrate from v1 (chartset) to v2 (dashboard) schema
 */
function migrateFromV1(oldData: LegacyStorageSchema): DashboardStorageSchema {
  const now = new Date().toISOString();

  const widgets: Widget[] = oldData.chartsets.map((chartset) => {
    // Convert each old chartset to a container widget
    const children: Widget[] = chartset.widgets.map((oldWidget, index) => ({
      id: oldWidget.id,
      componentId: "card", // Map all old widget types to card for now
      layout: {
        i: oldWidget.id,
        x: oldWidget.layout?.x ?? index % 3,
        y: oldWidget.layout?.y ?? Math.floor(index / 3),
        w: oldWidget.layout?.w ?? oldWidget.size ?? 1,
        h: oldWidget.layout?.h ?? 1,
      },
      config: {
        name: oldWidget.title || "Metric",
        value: "0",
        backgroundColor: "white",
        icon: "chart",
      },
      createdAt: now,
      updatedAt: now,
    }));

    return {
      id: chartset.id,
      componentId: "container",
      layout: {
        i: chartset.id,
        x: 0,
        y: 0,
        w: 3,
        h: 2,
      },
      config: {
        name: chartset.name || "Untitled Dashboard",
        description: chartset.description || "",
      },
      children,
      createdAt: chartset.createdAt || now,
      updatedAt: chartset.updatedAt || now,
    };
  });

  return {
    version: 2,
    widgets,
    preferences: oldData.preferences || { editMode: false },
  };
}

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

/**
 * Hook for persisting dashboard data to localStorage
 * Supports migration from v1 (chartset) to v2 (dashboard) schema
 */
export function useDashboardStorage() {
  const [data, setData] = useState<DashboardStorageSchema>(DEFAULT_STORAGE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      // First check for new storage key
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.version === 2) {
          // Current version - ensure defaults
          const migratedWidgets = parsed.widgets.map((w: Widget, i: number) =>
            ensureWidgetDefaults(w, i)
          );
          setData({ ...parsed, widgets: migratedWidgets });
        } else {
          // Unknown version - reset
          setData(DEFAULT_STORAGE);
        }
      } else {
        // Check for old chartset storage key
        const oldStored = localStorage.getItem(OLD_STORAGE_KEY);
        if (oldStored) {
          const oldParsed = JSON.parse(oldStored) as LegacyStorageSchema;
          if (oldParsed.version === 1) {
            // Migrate from v1
            const migrated = migrateFromV1(oldParsed);
            setData(migrated);
            // Save to new key
            localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            // Remove old key
            localStorage.removeItem(OLD_STORAGE_KEY);
            console.log("Migrated dashboard data from v1 to v2");
          }
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
  const findParent = useCallback(
    (
      widgetId: string,
      widgets: Widget[] = data.widgets,
      parent: Widget | null = null
    ): Widget | null => {
      for (const widget of widgets) {
        if (widget.id === widgetId) return parent;
        if (widget.children) {
          const found = findParent(widgetId, widget.children, widget);
          if (found !== undefined) return found;
        }
      }
      return null;
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
        const updatedWidgets = data.widgets.map((widget) => {
          const layout = layouts.find((l) => l.i === widget.id);
          if (layout) {
            return {
              ...widget,
              layout,
              updatedAt: new Date().toISOString(),
            };
          }
          return widget;
        });

        const newData: DashboardStorageSchema = {
          ...data,
          widgets: updatedWidgets,
        };
        saveData(newData);
        return;
      }

      // Otherwise update children of a specific parent
      const updateInTree = (widgets: Widget[]): Widget[] =>
        widgets.map((w) => {
          if (w.id === parentId && w.children) {
            const updatedChildren = w.children.map((child) => {
              const layout = layouts.find((l) => l.i === child.id);
              if (layout) {
                return {
                  ...child,
                  layout,
                  updatedAt: new Date().toISOString(),
                };
              }
              return child;
            });
            return {
              ...w,
              children: updatedChildren,
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

  return {
    widgets: data.widgets,
    preferences: data.preferences,
    isLoaded,
    addWidget,
    addChildWidget,
    updateWidgetConfig,
    updateWidgetLayouts,
    deleteWidget,
    setEditMode,
    findWidget,
    findParent,
  };
}
