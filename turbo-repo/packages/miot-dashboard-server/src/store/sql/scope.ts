import type { ServerDashboardRef } from "../../seams/store";
import type { SqlDriver } from "./driver";

/** The same lock protects dashboard ACL/config writes and folder mutations. */
export function sqlScopeTransaction<T>(
  driver: SqlDriver,
  scope: Pick<ServerDashboardRef, "tenantId" | "scopeId">,
  body: () => Promise<T>,
): Promise<T> {
  return driver.transaction(async () => {
    const lock = driver.dialect.folderLock;
    if (lock)
      await driver.all(lock, [
        JSON.stringify([
          "miot-dashboard-folders",
          scope.tenantId,
          scope.scopeId,
        ]),
      ]);
    return body();
  });
}
