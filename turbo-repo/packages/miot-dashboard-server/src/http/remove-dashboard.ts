import { DashboardServerError } from "../access/errors";
import type { ServerDashboardRef, ServerDashboardStore } from "../seams/store";
import type { DashboardStarStore } from "../seams/stars";
import type { DashboardRecentStore } from "../seams/recents";

interface PersonalStores {
  stars?: DashboardStarStore;
  recents?: DashboardRecentStore;
}

export async function forgetPersonalDashboard(
  personal: PersonalStores,
  ref: ServerDashboardRef,
): Promise<void> {
  await personal.stars?.forget(ref, ref.slug);
  await personal.recents?.forget(ref, ref.slug);
}

/** Reference stores also guard against a write made outside the scope transaction. */
export async function removeAuthorizedDashboard(
  store: ServerDashboardStore,
  ref: ServerDashboardRef,
  revision: number,
  serialized = false,
  personal: PersonalStores = {},
): Promise<void> {
  if (store.removeIfRevision) {
    if (!(await store.removeIfRevision(ref, revision))) {
      throw DashboardServerError.conflict(
        "The dashboard changed; reload before deleting it",
      );
    }
  } else if (serialized) {
    // Custom folder adapters guarantee serialization with their dashboard
    // backend through DashboardFolderStore.transaction.
    await store.remove(ref);
  } else {
    throw DashboardServerError.conflict(
      "The store cannot verify the authorized revision before deletion",
    );
  }
  // Cleanup belongs to this deletion, under the caller's scope transaction.
  await forgetPersonalDashboard(personal, ref);
}
