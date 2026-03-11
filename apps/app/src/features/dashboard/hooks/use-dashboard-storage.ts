"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  type Widget,
  type DashboardStorageSchema,
  DEFAULT_STORAGE,
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

/** Strip editMode from config before persisting to Alfresco */
function stripEphemeralState(
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
 * Hook for persisting dashboard data to localStorage and optionally to Alfresco.
 * @param storageKey    - The localStorage key to use (e.g. "dashboard-config")
 * @param defaultConfig - Optional server-loaded default config. Used only when
 *                        localStorage has no saved data for this key yet.
 * @param siteId        - Optional Alfresco site short name. When provided, configs
 *                        are also persisted to Alfresco as source of truth.
 */
export function useDashboardStorage(
  storageKey: string,
  defaultConfig?: DashboardStorageSchema | null,
  siteId?: string | null
) {
  const [data, setData] = useState<DashboardStorageSchema>(DEFAULT_STORAGE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Refs for debounced Alfresco save and background fetch
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<DashboardStorageSchema | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasLocalEditsRef = useRef(false);
  const siteIdRef = useRef(siteId);
  siteIdRef.current = siteId;

  // Derive slug from storageKey: "dashboard-config" → "dashboard"
  const slug = storageKey.replace(/-config$/, "");

  /** Save config to Alfresco with retry */
  const saveToAlfresco = useCallback(
    async (configData: DashboardStorageSchema, retryCount = 0) => {
      const currentSiteId = siteIdRef.current;
      if (!currentSiteId) return;

      try {
        const response = await fetch("/app/api/dashboard/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            site: currentSiteId,
            slug,
            config: stripEphemeralState(configData),
          }),
        });

        if (!response.ok) {
          throw new Error(`Alfresco save failed: ${response.status}`);
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
        // Use keepalive to ensure the request completes even during page teardown
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
          // Best-effort — data is already in localStorage
        });
      }
    };
  }, [slug]);

  // Load data from localStorage on mount, then background-fetch from Alfresco
  useEffect(() => {
    setIsLoaded(false);
    setData(DEFAULT_STORAGE);
    hasLocalEditsRef.current = false;

    let localData: DashboardStorageSchema = DEFAULT_STORAGE;

    // Phase 1: Instant load from localStorage
    try {
      const stored = localStorage.getItem(storageKey);

      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.version === 2) {
          const migratedWidgets = parsed.widgets.map((w: Widget, i: number) =>
            ensureWidgetDefaults(w, i)
          );
          const name = parsed.name || DEFAULT_STORAGE.name;
          localData = { ...parsed, name, widgets: migratedWidgets };
        } else {
          localData = defaultConfig ?? DEFAULT_STORAGE;
        }
      } else if (defaultConfig) {
        const migratedWidgets = defaultConfig.widgets.map(
          (w: Widget, i: number) => ensureWidgetDefaults(w, i)
        );
        localData = { ...defaultConfig, widgets: migratedWidgets };
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      localData = defaultConfig ?? DEFAULT_STORAGE;
    }
    setData(localData);
    setIsLoaded(true);

    // Phase 2: Background fetch from Alfresco (source of truth)
    if (siteId) {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      fetch(
        `/app/api/dashboard/config?site=${encodeURIComponent(siteId)}&slug=${encodeURIComponent(slug)}`,
        { signal: abortController.signal }
      )
        .then((res) => res.json())
        .then((result: { data: DashboardStorageSchema | null }) => {
          if (abortController.signal.aborted) return;
          // Skip applying Alfresco data if user has made local edits since mount
          if (hasLocalEditsRef.current) return;
          if (result.data) {
            const alfrescoData = result.data;
            const migratedWidgets = alfrescoData.widgets.map(
              (w: Widget, i: number) => ensureWidgetDefaults(w, i)
            );
            const resolved: DashboardStorageSchema = {
              ...alfrescoData,
              widgets: migratedWidgets,
              preferences: {
                ...alfrescoData.preferences,
                editMode: false,
              },
            };

            setData(resolved);
            try {
              localStorage.setItem(storageKey, JSON.stringify(resolved));
            } catch {
              // localStorage write failure is non-critical
            }
          }
        })
        .catch((error: unknown) => {
          if (abortController.signal.aborted) return;
          console.warn(
            "Failed to fetch dashboard config from Alfresco, using local data:",
            error
          );
        });

      return () => {
        abortController.abort();
      };
    }
  }, [storageKey, siteId, slug]); // defaultConfig is intentionally omitted — it's stable per page load

  // Save data to localStorage + schedule Alfresco save
  const saveData = useCallback(
    (newData: DashboardStorageSchema) => {
      hasLocalEditsRef.current = true;
      setData(newData);
      try {
        localStorage.setItem(storageKey, JSON.stringify(newData));
      } catch (error) {
        console.error("Failed to save dashboard data:", error);
      }
      scheduleSaveToAlfresco(newData);
    },
    [storageKey, scheduleSaveToAlfresco]
  );

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

  // Set edit mode (ephemeral — only localStorage, no Alfresco save)
  const setEditMode = useCallback(
    (editMode: boolean) => {
      const newData: DashboardStorageSchema = {
        ...data,
        preferences: { ...data.preferences, editMode },
      };
      setData(newData);
      try {
        localStorage.setItem(storageKey, JSON.stringify(newData));
      } catch {
        // non-critical
      }
    },
    [data, storageKey]
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
    link.download = `${data.name.replaceAll(/\s+/g, "_").toLowerCase()}_dashboard.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
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
