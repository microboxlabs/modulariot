"use client";

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  Suspense,
  type PropsWithChildren,
} from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useDashboard } from "./dashboard-context";

interface DashboardFiltersContextValue {
  /** Active filter values from URL params (keyed by filter param key) */
  activeFilters: Record<string, string>;
  /** Set a filter value (updates URL) */
  setFilter: (key: string, value: string) => void;
  /** Remove a single filter (updates URL) */
  removeFilter: (key: string) => void;
  /** Remove all filters (updates URL) */
  clearFilters: () => void;
}

const EMPTY_FILTERS: Record<string, string> = {};
const NOOP = () => {};

const DashboardFiltersContext =
  createContext<DashboardFiltersContextValue>({
    activeFilters: EMPTY_FILTERS,
    setFilter: NOOP,
    removeFilter: NOOP,
    clearFilters: NOOP,
  });

/**
 * Inner provider that uses useSearchParams (requires Suspense boundary).
 */
function DashboardFiltersInner({ children }: Readonly<PropsWithChildren>) {
  const { filters } = useDashboard();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Build a set of configured filter keys (including _from/_to for date ranges)
  const filterKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const f of filters) {
      if (f.type === "date_range") {
        keys.add(`${f.key}_from`);
        keys.add(`${f.key}_to`);
      } else {
        keys.add(f.key);
      }
    }
    return keys;
  }, [filters]);

  // Extract active filter values from URL params
  const activeFilters = useMemo(() => {
    const result: Record<string, string> = {};
    for (const key of filterKeys) {
      const value = searchParams.get(key);
      if (value) {
        result[key] = value;
      }
    }
    return result;
  }, [searchParams, filterKeys]);

  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());

      // Match on exact key or base key for suffixed params (e.g. date_range_from → date_range)
      const filterConfig = filters.find(
        (f) => f.key === key || key.startsWith(`${f.key}_`)
      );
      if (filterConfig?.unique && value) {
        // Clear only params belonging to this filter's base key
        for (const k of filterKeys) {
          if (k === filterConfig.key || k.startsWith(`${filterConfig.key}_`)) {
            params.delete(k);
          }
        }
      }

      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [searchParams, router, pathname, filters, filterKeys]
  );

  const removeFilter = useCallback(
    (key: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(key);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [searchParams, router, pathname]
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of filterKeys) {
      params.delete(key);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, router, pathname, filterKeys]);

  const value = useMemo(
    () => ({ activeFilters, setFilter, removeFilter, clearFilters }),
    [activeFilters, setFilter, removeFilter, clearFilters]
  );

  return (
    <DashboardFiltersContext.Provider value={value}>
      {children}
    </DashboardFiltersContext.Provider>
  );
}

/**
 * Outer provider with Suspense boundary for useSearchParams.
 */
export function DashboardFiltersProvider({ children }: Readonly<PropsWithChildren>) {
  return (
    <Suspense fallback={children}>
      <DashboardFiltersInner>{children}</DashboardFiltersInner>
    </Suspense>
  );
}

export function useDashboardFilters() {
  return useContext(DashboardFiltersContext);
}
