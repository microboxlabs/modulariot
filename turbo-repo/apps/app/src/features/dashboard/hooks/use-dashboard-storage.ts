"use client";
import { useEffect, useCallback, useRef } from "react";
import useSWR from "swr";
import fetcher from "@/features/common/providers/fetcher";
import {
  DEFAULT_STORAGE,
  type Widget,
  type DashboardStorageSchema,
} from "../types/dashboard.types";
import { getDashlet } from "../dashlets";
import {
  useDashboardState,
  ensureWidgetDefaults as resolveWidgetDefaults,
  stripEphemeralState,
  type DashboardStorageController,
} from "@microboxlabs/miot-dashboard-ui/react";
export {
  applyLayoutToWidget,
  updateChildrenLayouts,
  stripEphemeralState,
} from "@microboxlabs/miot-dashboard-ui/react";
export type { DashboardStorageController } from "@microboxlabs/miot-dashboard-ui/react";
export function ensureWidgetDefaults(
  widget: Widget,
  index: number,
  resolveDashlet: typeof getDashlet = getDashlet
): Widget {
  return resolveWidgetDefaults(widget, index, resolveDashlet);
}
const ALFRESCO_DEBOUNCE_MS = 2000;
const ALFRESCO_MAX_RETRIES = 3;
const ALFRESCO_RETRY_BASE_MS = 1000;
/** App persistence adapter; the library owns controlled editing state. */
export function useDashboardStorage(
  slug: string,
  defaultConfig?: DashboardStorageSchema | null,
  siteId?: string | null,
  controller?: DashboardStorageController,
  resolveDashlet: typeof getDashlet = getDashlet
) {
  // Stabilize fallback via ref — defaultConfig comes from server props and is
  // referentially stable per page load, but we guard against inline objects.
  const fallbackRef = useRef(defaultConfig ?? DEFAULT_STORAGE);
  const readOnly = Boolean(
    controller && (controller.readOnly || !controller.isLoaded)
  );

  // SWR key — null when no siteId (disables fetch)
  const swrKey =
    siteId && !controller
      ? `/app/api/dashboard/config?site=${encodeURIComponent(siteId)}&slug=${encodeURIComponent(slug)}`
      : null;

  const {
    data: response,
    mutate,
    isLoading,
  } = useSWR<{ data: DashboardStorageSchema | null }>(swrKey, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
    fallbackData: { data: fallbackRef.current },
  });

  const rawConfig = controller?.config ?? response?.data ?? fallbackRef.current;

  // Refs for debounced Alfresco save
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<DashboardStorageSchema | null>(null);
  const effectiveSiteId = controller ? null : siteId;
  const siteIdRef = useRef(effectiveSiteId);
  siteIdRef.current = effectiveSiteId;

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
          const delay = ALFRESCO_RETRY_BASE_MS * Math.pow(2, retryCount);
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
      if (controller) {
        if (!readOnly) controller.onChange(stripEphemeralState(newData));
        return;
      }
      void mutate({ data: newData }, { revalidate: false });
      scheduleSaveToAlfresco(newData);
    },
    [controller, readOnly, mutate, scheduleSaveToAlfresco]
  );

  return useDashboardState(
    controller ?? {
      config: rawConfig,
      isLoaded: swrKey ? !isLoading : true,
      readOnly: false,
      onChange: rawSaveData,
    },
    resolveDashlet
  );
}
