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
  return createMiotCalendarClient({
    baseUrl: baseUrl!,
    headers: {
      Authorization: `Bearer ${session.user?.rawJWT ?? session.user?.ticket ?? ""}`,
    },
  });
}
