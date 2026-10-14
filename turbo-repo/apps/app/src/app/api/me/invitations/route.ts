import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/** The signed-in email's open invitations, in any organization. */
export async function GET() {
  return forwardToQuarkus("/api/v1/me/invitations");
}
