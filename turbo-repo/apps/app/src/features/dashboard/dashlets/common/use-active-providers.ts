import { useMemo } from "react";
import { useDashboard } from "@/features/dashboard/context/dashboard-context";
import { useDataSources } from "@/features/data-sources/hooks/use-data-sources";

interface ActiveProvider {
  id: string;
  name: string;
}

/**
 * Hook that returns the list of active, successfully-tested data source providers
 * for the current dashboard's site. Uses SWR under the hood (via useDataSources),
 * so multiple callers with the same siteId share a single cache entry.
 */
export function useActiveProviders(): ActiveProvider[] {
  const { siteId } = useDashboard();
  const { dataSources } = useDataSources(siteId ?? undefined);

  return useMemo(
    () =>
      dataSources
        .filter((ds) => ds.isActive === true && ds.lastTestResult === true)
        .map((ds) => ({ id: ds.id, name: ds.name })),
    [dataSources],
  );
}
