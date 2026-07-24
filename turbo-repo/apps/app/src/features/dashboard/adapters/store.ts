import type {
  DashboardStorageSchema,
  DashboardStore,
  DashboardSummary,
} from "@microboxlabs/miot-dashboard-ui";

/**
 * Seam E implementation: `DashboardStore` over the app's existing Next API
 * routes (which proxy to Alfresco today; the endpoints' verbs/payloads mirror
 * `use-dashboard-storage.ts` exactly). `scopeId` maps onto the Alfresco site
 * short name. The P2 hook rewrite consumes this; behavior is unchanged.
 */
export function createAppDashboardStore(
  fetchImpl: typeof fetch = (...args) => fetch(...args)
): DashboardStore {
  return {
    async load(ref) {
      const res = await fetchImpl(
        `/app/api/dashboard/config?site=${encodeURIComponent(ref.scopeId)}&slug=${encodeURIComponent(ref.slug)}`
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`dashboard load failed: ${res.status}`);
      return (await res.json()) as DashboardStorageSchema | null;
    },

    async save(ref, config) {
      const res = await fetchImpl("/app/api/dashboard/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: ref.scopeId, slug: ref.slug, config }),
      });
      if (!res.ok) throw new Error(`dashboard save failed: ${res.status}`);
    },

    async list(scopeId) {
      const res = await fetchImpl(
        `/app/api/dashboard/configs?site=${encodeURIComponent(scopeId)}`
      );
      if (!res.ok) throw new Error(`dashboard list failed: ${res.status}`);
      const body = (await res.json()) as { data?: DashboardSummary[] };
      return body.data ?? [];
    },

    async remove(ref) {
      const res = await fetchImpl(
        `/app/api/dashboard/config?site=${encodeURIComponent(ref.scopeId)}&slug=${encodeURIComponent(ref.slug)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`dashboard delete failed: ${res.status}`);
    },
  };
}
