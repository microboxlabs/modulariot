/**
 * Write seed dashboards into a store that already has data in it.
 *
 * `createMemoryStore` takes its seed at construction. A persistent store
 * cannot: applying the seed on every start would overwrite edits made since,
 * so a dashboard is written only when its slug is absent.
 */

import type { ServerDashboardStore } from "../seams/store";
import type { SeedDashboard } from "../testing";

export async function seedDashboards(
  store: ServerDashboardStore,
  dashboards: readonly SeedDashboard[],
): Promise<string[]> {
  const written: string[] = [];

  for (const dashboard of dashboards) {
    if ((await store.load(dashboard.ref)) !== null) continue;

    await store.save(dashboard.ref, dashboard.record?.config ?? null, {
      // `createdBy` first: the store sets created_by from this on insert, and
      // the capability policy reads it to decide Contributor edit-own access.
      // Passing only `updatedBy` made every seeded dashboard belong to nobody.
      updatedBy:
        dashboard.record?.createdBy ?? dashboard.record?.updatedBy ?? "seed",
    });

    if (dashboard.assignments) {
      await store.setPermissions(dashboard.ref, dashboard.assignments);
    }
    written.push(dashboard.ref.slug);
  }

  return written;
}
