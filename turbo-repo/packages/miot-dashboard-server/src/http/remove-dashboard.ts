import { DashboardServerError } from "../access/errors";
import type { ServerDashboardRef, ServerDashboardStore } from "../seams/store";

/** Reference stores also guard against a write made outside the scope transaction. */
export async function removeAuthorizedDashboard(
  store: ServerDashboardStore,
  ref: ServerDashboardRef,
  revision: number,
): Promise<void> {
  if (store.removeIfRevision) {
    if (!(await store.removeIfRevision(ref, revision))) {
      throw DashboardServerError.conflict(
        "The dashboard changed; reload before deleting it",
      );
    }
  } else {
    // Custom folder adapters guarantee serialization with their dashboard
    // backend through DashboardFolderStore.transaction.
    await store.remove(ref);
  }
}
