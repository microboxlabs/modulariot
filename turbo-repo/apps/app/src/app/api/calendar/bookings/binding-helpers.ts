import { logger } from "@/lib/logger";
import {
  notifyCalendarBinding,
  type CalendarBindingPayload,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import type { Session } from "next-auth";

export async function runCalendarBinding(
  session: Session,
  payload: CalendarBindingPayload
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  try {
    const result = await notifyCalendarBinding(session, payload);
    logger.info(
      {
        numeroServicio: payload.numero_servicio,
        calendarId: payload.calendar_id,
        stage: payload.stage,
        status: result.status,
      },
      "Calendar binding call completed"
    );
    return { ok: true };
  } catch (error) {
    logger.error(
      {
        err: error,
        numeroServicio: payload.numero_servicio,
        calendarId: payload.calendar_id,
        stage: payload.stage,
      },
      "Failed to call calendar binding"
    );
    const message =
      error instanceof Error ? error.message : "Failed to update calendar binding";
    return { ok: false, status: 502, message };
  }
}
