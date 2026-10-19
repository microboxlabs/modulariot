import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/** POST /api/admin/platform/mail/test — checks the platform sender's key with Resend. */
export async function POST() {
  return forwardToQuarkus("/api/v1/platform/mail/test", { method: "POST" });
}
