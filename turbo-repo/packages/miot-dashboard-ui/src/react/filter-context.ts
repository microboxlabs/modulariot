"use client";
import {
  createContext,
  createElement,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import {
  useDashboardFilterState,
  type DashboardFilterController,
} from "./filter-state";
const FilterContext = createContext<ReturnType<
  typeof useDashboardFilterState
> | null>(null);
export function DashboardFiltersProvider({
  controller,
  children,
}: Readonly<PropsWithChildren<{ controller: DashboardFilterController }>>) {
  const value = useDashboardFilterState(controller);
  return createElement(FilterContext.Provider, { value }, children);
}
export function useDashboardFilters() {
  const value = useContext(FilterContext);
  const fallback = useMemo<ReturnType<typeof useDashboardFilterState>>(
    () => ({
      activeFilters: {},
      setFilter: (_key: string, _value: string) => {},
      removeFilter: (_key: string) => {},
      clearFilters: () => {},
    }),
    [],
  );
  return value ?? fallback;
}
