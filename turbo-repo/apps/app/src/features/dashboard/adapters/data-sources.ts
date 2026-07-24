import type { DataSourceListItem } from "@/features/data-sources/types";
import type {
  DashboardDataSource,
  DataSourceProvider,
} from "@microboxlabs/miot-dashboard-ui";

/**
 * Seam D implementation: `DataSourceProvider` over the app's data-sources
 * API. Maps the app's `DataSourceListItem` (connection details included) down
 * to the package's host-agnostic descriptor — credentials never cross the
 * seam. P2 extends this with the query path.
 */
export function createAppDataSourceProvider(
  siteId: string,
  fetchImpl: typeof fetch = (...args) => fetch(...args)
): DataSourceProvider {
  return {
    async listDataSources(): Promise<DashboardDataSource[]> {
      const res = await fetchImpl(
        `/app/api/data-sources?siteId=${encodeURIComponent(siteId)}`
      );
      if (!res.ok) throw new Error(`data-sources list failed: ${res.status}`);
      const items = (await res.json()) as DataSourceListItem[];
      return items.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        description: item.description,
        isActive: item.isActive,
      }));
    },
  };
}
