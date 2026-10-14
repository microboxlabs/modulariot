import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/** POST /api/admin/platform/vehicle-images/test — checks the key and secret with carimagesapi.com. */
export async function POST() {
  return forwardToQuarkus("/api/v1/platform/vehicle-images/test", {
    method: "POST",
  });
}
