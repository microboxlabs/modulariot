import { createMiotCalendarClient } from "@microboxlabs/miot-calendar-client";
import type { Session } from "next-auth";

const baseUrl = process.env.MIOT_CALENDAR_URL;
if (!baseUrl) {
  throw new Error(
    "MIOT_CALENDAR_URL environment variable is not set. " +
      "Ensure it is defined before starting the server."
  );
}

export function createCalendarClient(session: Session) {
  const token = session.user?.rawJWT ?? session.user?.ticket;
  if (!token) {
    throw new Error("No authentication token found in session.");
  }
  return createMiotCalendarClient({
    baseUrl: baseUrl!,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
