import "server-only";
import { createMiotCalendarClient } from "@microboxlabs/miot-calendar-client";
import type { Session } from "next-auth";
import { sessionAuthHeader, sessionToken } from "@/features/auth/services/session-auth";

export function createCalendarClient(session: Session) {
  const baseUrl = process.env.MIOT_CALENDAR_URL;
  if (!baseUrl) {
    throw new Error(
      "MIOT_CALENDAR_URL environment variable is not set. " +
        "Ensure it is defined before starting the server."
    );
  }
  if (!sessionToken(session)) {
    throw new Error("No authentication token found in session.");
  }
  return createMiotCalendarClient({
    baseUrl,
    headers: sessionAuthHeader(session),
  });
}
