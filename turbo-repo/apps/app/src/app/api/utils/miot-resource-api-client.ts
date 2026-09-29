import "server-only";
import { createMiotResourceClient } from "@microboxlabs/miot-resource-client";
import type { Session } from "next-auth";
import { modulithHost } from "@/lib/modulith-host";
import { sessionAuthHeader, sessionToken } from "@/features/auth/services/session-auth";

export function createResourceClient(session: Session) {
  const baseUrl = modulithHost();
  if (!baseUrl) {
    throw new Error(
      "MIOT_MODULITH_URL environment variable is not set. " +
        "Ensure it is defined before starting the server."
    );
  }
  const organizationId = process.env.MIOT_DEFAULT_ORG_ID;
  if (!organizationId) {
    throw new Error(
      "MIOT_DEFAULT_ORG_ID environment variable is not set. " +
        "Ensure it is defined before starting the server."
    );
  }
  if (!sessionToken(session)) {
    throw new Error("No authentication token found in session.");
  }
  return createMiotResourceClient({
    baseUrl,
    organizationId,
    headers: sessionAuthHeader(session),
  });
}
