import { createMiotCalendarClient } from "@microboxlabs/miot-calendar-client";
import type { Session } from "next-auth";

export function createCalendarClient(session: Session) {
  return createMiotCalendarClient({
    baseUrl: process.env.MIOT_CALENDAR_URL ?? "",
    headers: {
      Authorization: `Bearer ${session.user?.rawJWT ?? session.user?.ticket ?? ""}`,
    },
  });
}
