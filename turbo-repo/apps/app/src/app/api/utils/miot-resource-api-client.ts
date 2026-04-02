import "server-only";
import { createMiotResourceClient } from "@microboxlabs/miot-resource-client";
import type { Session } from "next-auth";

export function createResourceClient(session: Session) {
  const baseUrl = process.env.MIOT_RESOURCE_URL;
  if (!baseUrl) {
    throw new Error(
      "MIOT_RESOURCE_URL environment variable is not set. " +
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
  const token = session.user?.rawJWT ?? session.user?.ticket;
  if (!token) {
    throw new Error("No authentication token found in session.");
  }
  return createMiotResourceClient({
    baseUrl,
    organizationId,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
