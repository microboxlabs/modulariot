import { ShowNotification } from "@/features/notifications/notification";
import type { NotifyFn } from "@microboxlabs/miot-dashboard-ui";

/**
 * Seam C implementation: the package's four notify levels map 1:1 onto the
 * app's sonner-backed `ShowNotification` action types.
 */
export const appNotify: NotifyFn = (level, message) => {
  ShowNotification({ type: level, message });
};
