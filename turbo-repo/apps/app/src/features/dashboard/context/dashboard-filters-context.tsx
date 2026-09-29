"use client";

import { useCallback, useMemo, Suspense, type PropsWithChildren } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { DashboardFiltersProvider as ControlledFiltersProvider } from "@microboxlabs/miot-dashboard-ui/react";
import { useDashboard } from "./dashboard-context";
export { useDashboardFilters } from "@microboxlabs/miot-dashboard-ui/react";

/** Next.js URL adapter; portable filters only receive explicit host state. */
function DashboardFiltersInner({ children }: Readonly<PropsWithChildren>) {
  const { filters } = useDashboard();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const values = useMemo(
    () => Object.fromEntries(searchParams.entries()),
    [searchParams]
  );
  const onChange = useCallback(
    (next: Record<string, string>) => {
      // Retain unrelated duplicate URL parameters and their ordering.
      const params = new URLSearchParams(searchParams.toString());
      for (const key of Object.keys(values)) {
        if (!Object.hasOwn(next, key)) params.delete(key);
      }
      for (const [key, value] of Object.entries(next)) {
        if (!Object.hasOwn(values, key) || values[key] !== value)
          params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname, values]
  );
  const controller = useMemo(
    () => ({ definitions: filters, values, onChange }),
    [filters, values, onChange]
  );
  return (
    <ControlledFiltersProvider controller={controller}>
      {children}
    </ControlledFiltersProvider>
  );
}

export function DashboardFiltersProvider({
  children,
}: Readonly<PropsWithChildren>) {
  return (
    <Suspense fallback={null}>
      <DashboardFiltersInner>{children}</DashboardFiltersInner>
    </Suspense>
  );
}
